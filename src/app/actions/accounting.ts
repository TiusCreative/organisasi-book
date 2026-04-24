"use server"

import { prisma } from "@/lib/prisma"
import { requireModuleAccess } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { createJournalInTx } from "@/lib/accounting/journal"

export async function getJournals(filters?: { startDate?: string; endDate?: string; accountType?: string }) {
  try {
    // Asumsi permission string untuk modul akuntansi adalah "accounting"
    const { organization } = await requireModuleAccess("accounting" as any) 
    
    const whereClause: any = { organizationId: organization.id }
    
    if (filters?.startDate || filters?.endDate) {
      whereClause.date = {}
      if (filters.startDate) whereClause.date.gte = new Date(filters.startDate)
      if (filters.endDate) whereClause.date.lte = new Date(filters.endDate)
    }

    if (filters?.accountType) {
      whereClause.lines = { some: { account: { type: filters.accountType } } }
    }

    const journals = await prisma.transaction.findMany({
      where: whereClause,
      include: {
        lines: {
          include: { account: true }
        }
      },
      orderBy: { createdAt: "desc" }, // Urutkan dari yang terbaru
    })

    return { success: true, journals }
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal mengambil data jurnal." }
  }
}

export async function getChartOfAccounts() {
  try {
    const { organization } = await requireModuleAccess("accounting" as any) 
    const accounts = await prisma.chartOfAccount.findMany({
      where: { organizationId: organization.id },
      orderBy: [
        { type: "asc" },
        { code: "asc" }
      ]
    })
    return { success: true, accounts }
  } catch (error: any) {
    return { success: false, accounts: [], error: error.message || "Gagal mengambil data akun." }
  }
}

export async function createChartOfAccount(data: { code: string; name: string; type: string; isHeader: boolean }) {
  try {
    const { organization } = await requireModuleAccess("accounting" as any) 
    
    const account = await prisma.chartOfAccount.create({
      data: {
        organizationId: organization.id,
        code: data.code,
        name: data.name,
        type: data.type,
        isHeader: data.isHeader
      }
    })
    
    revalidatePath(`/organization/${organization.id}/accounting/coa`)
    return { success: true, account }
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal membuat akun." }
  }
}

export async function deleteChartOfAccount(id: string) {
  try {
    const { organization } = await requireModuleAccess("accounting" as any) 
    
    await prisma.chartOfAccount.delete({
      where: { id, organizationId: organization.id }
    })
    
    revalidatePath(`/organization/${organization.id}/accounting/coa`)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menghapus akun, mungkin akun ini sudah dipakai transaksi." }
  }
}

export async function getBalanceSheetData(asOfDate?: string) {
  try {
    const { organization } = await requireModuleAccess("accounting" as any)
    
    // Ambil semua akun beserta total transaksi line-nya
    const accounts = await prisma.chartOfAccount.findMany({
      where: { organizationId: organization.id },
      include: {
        journalItems: {
          where: asOfDate ? { transaction: { date: { lte: new Date(asOfDate) } } } : undefined,
          select: { debit: true, credit: true }
        }
      },
      orderBy: { code: 'asc' }
    })

    let totalAssets = 0
    let totalLiabilities = 0
    let totalEquity = 0

    const assets: any[] = []
    const liabilities: any[] = []
    const equities: any[] = []

    let totalRevenue = 0
    let totalExpense = 0

    for (const acc of accounts) {
      const debitSum = acc.journalItems.reduce((sum, item) => sum + item.debit, 0)
      const creditSum = acc.journalItems.reduce((sum, item) => sum + item.credit, 0)

      if (acc.type === "Asset") {
        const balance = debitSum - creditSum
        if (balance !== 0 || acc.isHeader) assets.push({ ...acc, balance })
        if (!acc.isHeader) totalAssets += balance
      } else if (acc.type === "Liability") {
        const balance = creditSum - debitSum
        if (balance !== 0 || acc.isHeader) liabilities.push({ ...acc, balance })
        if (!acc.isHeader) totalLiabilities += balance
      } else if (acc.type === "Equity") {
        const balance = creditSum - debitSum
        if (balance !== 0 || acc.isHeader) equities.push({ ...acc, balance })
        if (!acc.isHeader) totalEquity += balance
      } else if (acc.type === "Revenue") {
        totalRevenue += (creditSum - debitSum)
      } else if (acc.type === "Expense") {
        totalExpense += (debitSum - creditSum)
      }
    }

    // Laba Rugi Berjalan (Net Income) masuk ke komponen Modal/Ekuitas
    const netIncome = totalRevenue - totalExpense
    totalEquity += netIncome

    return { 
      success: true, 
      data: { assets, liabilities, equities, netIncome, totalAssets, totalLiabilities, totalEquity } 
    }
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal mengambil data neraca." }
  }
}

export async function createDirectExpense(formData: FormData) {
  try {
    const { organization, user } = await requireModuleAccess("accounting" as any)
    
    const date = new Date(formData.get("date") as string)
    const amount = parseFloat(formData.get("amount") as string)
    const description = formData.get("description") as string
    const debitAccountId = formData.get("debitAccountId") as string // Akun Beban (Misal: Beban Komisi)
    const creditAccountId = formData.get("creditAccountId") as string // Akun Kas/Bank (Uang Keluar)
    
    await prisma.$transaction(async (tx) => {
      await createJournalInTx(tx, {
        organizationId: organization.id,
        date,
        description,
        reference: `EXP-${Date.now()}`,
        lines: [
          { accountId: debitAccountId, debit: amount, credit: 0, description },
          { accountId: creditAccountId, debit: 0, credit: amount, description }
        ],
        audit: { userId: user.id, userName: user.name, userEmail: user.email, entity: "DirectExpense" }
      })
    })
    
    revalidatePath(`/organization/${organization.id}/accounting/expenses`)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal mencatat pengeluaran." }
  }
}