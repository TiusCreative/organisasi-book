"use server"

import { prisma } from "@/lib/prisma"
import { requireWritableModuleAccess, requireModuleAccess } from "@/lib/auth"
import { createJournalInTx } from "@/lib/accounting/journal"
import { revalidatePath } from "next/cache"

export async function getPayrollData() {
  try {
    const { organization } = await requireModuleAccess("hr" as any)
    
    const [employees, slips, accounts] = await Promise.all([
      prisma.employee.findMany({ where: { organizationId: organization.id } }),
      prisma.salarySlip.findMany({ 
        where: { organizationId: organization.id },
        include: { employee: true },
        orderBy: { createdAt: "desc" }
      }),
      prisma.chartOfAccount.findMany({ where: { organizationId: organization.id } })
    ])

    return { success: true, employees, slips, accounts }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function createDraftSalarySlip(formData: FormData) {
  try {
    const { organization } = await requireWritableModuleAccess("hr" as any)
    
    const employeeId = formData.get("employeeId") as string
    const month = parseInt(formData.get("month") as string)
    const year = parseInt(formData.get("year") as string)
    
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
    if (!employee) throw new Error("Karyawan tidak ditemukan.")

    // Simulasi perhitungan (Dalam implementasi penuh ini mengambil data allowance & deduction terkait)
    const baseSalary = employee.baseSalary
    const totalAllowance = parseFloat(formData.get("allowance") as string) || 0
    const totalDeduction = parseFloat(formData.get("deduction") as string) || 0
    
    const grossIncome = baseSalary + totalAllowance
    const netIncome = grossIncome - totalDeduction

    const slip = await prisma.salarySlip.create({
      data: {
        organizationId: organization.id,
        employeeId,
        month,
        year,
        baseSalary,
        totalAllowance,
        totalDeduction,
        grossIncome,
        netIncome,
        status: "DRAFT"
      }
    })

    revalidatePath("/hr")
    return { success: true, slip }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function paySalarySlip(slipId: string, cashAccountId: string, expenseAccountId: string) {
  try {
    const { organization } = await requireWritableModuleAccess("hr" as any)
    
    await prisma.$transaction(async (tx) => {
      const slip = await tx.salarySlip.findUnique({ 
        where: { id: slipId, organizationId: organization.id },
        include: { employee: true }
      })
      if (!slip) throw new Error("Slip gaji tidak ditemukan.")
      if (slip.status === "PAID") throw new Error("Gaji ini sudah dibayar.")

      // 1. Ubah status menjadi PAID
      await tx.salarySlip.update({
        where: { id: slip.id },
        data: { status: "PAID", paymentDate: new Date() }
      })

      // 2. Otomasi Jurnal Akuntansi (Beban Gaji bertambah, Kas berkurang)
      await createJournalInTx(tx, {
        organizationId: organization.id,
        date: new Date(),
        description: `Pembayaran Gaji ${slip.employee.name} Periode ${slip.month}/${slip.year}`,
        reference: `PAY-${slip.year}-${slip.month}-${slip.employee.id.substring(0,4)}`,
        lines: [
          { accountId: expenseAccountId, debit: slip.netIncome, credit: 0, description: "Beban Gaji" },
          { accountId: cashAccountId, debit: 0, credit: slip.netIncome, description: "Pembayaran Gaji Keluar" }
        ]
      })
    })

    revalidatePath("/hr")
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}