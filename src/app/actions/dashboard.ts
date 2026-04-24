"use server"

import { prisma } from "@/lib/prisma"
import { requireModuleAccess } from "@/lib/auth"

export async function getFinancialDashboardData() {
  try {
    const { organization } = await requireModuleAccess("accounting" as any)
    
    // 1. Total Unpaid Invoices (Piutang Customer)
    const unpaidInvoices = await prisma.invoice.aggregate({
      where: { organizationId: organization.id, status: { in: ["DRAFT", "SENT", "PARTIALLY_PAID", "OVERDUE"] } },
      _sum: { remainingAmount: true }
    })

    // 2. Total Unpaid Vendor Bills (Hutang Supplier)
    const unpaidBills = await prisma.vendorBill.aggregate({
      where: { organizationId: organization.id, status: { in: ["DRAFT", "RECEIVED", "PARTIALLY_PAID", "OVERDUE"] } },
      _sum: { remainingAmount: true }
    })

    // 3. Ambil data Pendapatan & Pengeluaran tahun berjalan, dikelompokkan per bulan
    const currentYear = new Date().getFullYear()
    const startDate = new Date(currentYear, 0, 1)

    const transactions = await prisma.transactionLine.findMany({
      where: {
        transaction: {
          organizationId: organization.id,
          date: { gte: startDate }
        },
        account: {
          type: { in: ["Revenue", "Expense"] }
        }
      },
      include: {
        transaction: { select: { date: true } },
        account: { select: { type: true } }
      }
    })

    // Agregasi per bulan (12 Bulan)
    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(currentYear, i).toLocaleString('id-ID', { month: 'short' }),
      revenue: 0,
      expense: 0
    }))

    for (const line of transactions) {
      const monthIndex = line.transaction.date.getMonth()
      if (line.account.type === "Revenue") monthlyData[monthIndex].revenue += (line.credit - line.debit)
      if (line.account.type === "Expense") monthlyData[monthIndex].expense += (line.debit - line.credit)
    }

    return { success: true, unpaidInvoices: unpaidInvoices._sum.remainingAmount || 0, unpaidBills: unpaidBills._sum.remainingAmount || 0, monthlyData }
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal mengambil data dashboard." }
  }
}