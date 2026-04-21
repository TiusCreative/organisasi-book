"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "../../lib/prisma"
import { generateNoteNumber } from "../../lib/nota-generator"
import { logAudit } from "../../lib/audit-logger"
import { requireCurrentOrganization } from "../../lib/auth"
import { hasModulePermission } from "../../lib/permissions"

const INVESTMENT_TYPE_LABELS: Record<string, string> = {
  DEPOSITO: "Deposito",
  SAHAM: "Saham",
  INVESTASI_LAINNYA: "Investasi Lainnya",
}

function roundAmount(value: number) {
  return Math.round(value * 100) / 100
}

async function generateNextInvestmentAccountCode(tx: Pick<typeof prisma, "chartOfAccount">, orgId: string) {
  const accounts = await tx.chartOfAccount.findMany({
    where: {
      organizationId: orgId,
      type: "Asset",
      code: {
        startsWith: "14",
      },
    },
    select: { code: true },
  })

  const maxCode = accounts.reduce((currentMax, account) => {
    const parsed = Number(account.code)
    return Number.isFinite(parsed) ? Math.max(currentMax, parsed) : currentMax
  }, 1400)

  return String(maxCode + 1)
}

export async function createInvestment(formData: FormData) {
  const { user, organization } = await requireCurrentOrganization()

  // Permission check: hanya ADMIN, MANAGER, STAFF yang bisa membuat investasi
  if (!hasModulePermission(user, "investments")) {
    throw new Error("Anda tidak memiliki izin untuk membuat investasi.")
  }

  const organizationId = organization.id
  const type = formData.get("type") as string
  const name = formData.get("name") as string
  const institution = formData.get("institution") as string
  const referenceNumber = formData.get("referenceNumber") as string
  const sourceBankAccountId = (formData.get("sourceBankAccountId") as string) || null
  const startDate = new Date(formData.get("startDate") as string)
  const maturityDateRaw = formData.get("maturityDate") as string
  const maturityDate = maturityDateRaw ? new Date(maturityDateRaw) : null
  const purchaseAmount = parseFloat(formData.get("purchaseAmount") as string)
  const currentValue = parseFloat((formData.get("currentValue") as string) || String(purchaseAmount))
  const expectedReturn = parseFloat((formData.get("expectedReturn") as string) || "0")
  const notes = formData.get("notes") as string

  if (!organizationId || !type || !name || !institution || Number.isNaN(purchaseAmount)) {
    throw new Error("Data investasi tidak lengkap")
  }

  const investment = await prisma.$transaction(async (tx) => {
    const accountCode = await generateNextInvestmentAccountCode(tx, organizationId)
    const account = await tx.chartOfAccount.create({
      data: {
        organizationId,
        code: accountCode,
        name: `${INVESTMENT_TYPE_LABELS[type] || "Investasi"} - ${name}`,
        type: "Asset",
      },
    })

    return tx.investment.create({
      data: {
        organizationId,
        accountId: account.id,
        sourceBankAccountId,
        type,
        name,
        institution,
        referenceNumber: referenceNumber || null,
        startDate,
        maturityDate,
        purchaseAmount,
        currentValue: Number.isNaN(currentValue) ? purchaseAmount : currentValue,
        expectedReturn: Number.isNaN(expectedReturn) ? 0 : expectedReturn,
        notes: notes || null,
      },
      include: {
        account: true,
        sourceBankAccount: true,
        settlementBankAccount: true,
      },
    })
  })

  await logAudit({
    organizationId,
    action: "CREATE",
    entity: "Investment",
    entityId: investment.id,
    newData: investment,
  })

  revalidatePath("/investasi")
  revalidatePath("/bank")
  revalidatePath("/laporan/bank")
  revalidatePath("/akun")

  return { success: true, investment }
}

export async function updateInvestment(formData: FormData) {
  const { user } = await requireCurrentOrganization()

  // Permission check: hanya ADMIN, MANAGER, STAFF yang bisa update investasi
  if (!hasModulePermission(user, "investments")) {
    throw new Error("Anda tidak memiliki izin untuk mengubah investasi.")
  }

  const id = formData.get("id") as string
  const type = formData.get("type") as string
  const name = formData.get("name") as string
  const institution = formData.get("institution") as string
  const referenceNumber = formData.get("referenceNumber") as string
  const sourceBankAccountId = (formData.get("sourceBankAccountId") as string) || null
  const startDate = new Date(formData.get("startDate") as string)
  const maturityDateRaw = formData.get("maturityDate") as string
  const maturityDate = maturityDateRaw ? new Date(maturityDateRaw) : null
  const purchaseAmount = parseFloat(formData.get("purchaseAmount") as string)
  const currentValue = parseFloat(formData.get("currentValue") as string)
  const expectedReturn = parseFloat((formData.get("expectedReturn") as string) || "0")
  const status = (formData.get("status") as string) || "ACTIVE"
  const notes = formData.get("notes") as string

  if (!id || !type || !name || !institution || Number.isNaN(purchaseAmount) || Number.isNaN(currentValue)) {
    throw new Error("Data investasi tidak lengkap")
  }

  const existing = await prisma.investment.findUniqueOrThrow({
    where: { id },
    include: { account: true },
  })

  const investment = await prisma.$transaction(async (tx) => {
    await tx.chartOfAccount.update({
      where: { id: existing.accountId },
      data: {
        name: `${INVESTMENT_TYPE_LABELS[type] || "Investasi"} - ${name}`,
      },
    })

    return tx.investment.update({
      where: { id },
      data: {
        type,
        name,
        institution,
        referenceNumber: referenceNumber || null,
        sourceBankAccountId,
        startDate,
        maturityDate,
        purchaseAmount,
        currentValue,
        expectedReturn: Number.isNaN(expectedReturn) ? 0 : expectedReturn,
        status,
        notes: notes || null,
      },
      include: {
        account: true,
        sourceBankAccount: true,
        settlementBankAccount: true,
      },
    })
  })

  await logAudit({
    organizationId: investment.organizationId,
    action: "UPDATE",
    entity: "Investment",
    entityId: investment.id,
    oldData: existing,
    newData: investment,
  })

  revalidatePath("/investasi")
  revalidatePath("/bank")
  revalidatePath("/laporan/bank")
  revalidatePath("/akun")

  return { success: true, investment }
}

export async function deleteInvestment(id: string) {
  try {
    const { user } = await requireCurrentOrganization()

    // Permission check: hanya ADMIN yang bisa hapus investasi
    if (user.role !== "ADMIN") {
      throw new Error("Anda tidak memiliki izin untuk menghapus investasi. Hanya admin yang dapat menghapus.")
    }

    const existing = await prisma.investment.findUnique({
      where: { id },
      include: { account: true },
    })

    if (!existing) {
      throw new Error("Investasi tidak ditemukan")
    }

    if (existing.inkasoTransactionId) {
      throw new Error("Investasi yang sudah diinkaso tidak dapat dihapus")
    }

    await prisma.$transaction(async (tx) => {
      await tx.investment.delete({
        where: { id },
      })

      await tx.chartOfAccount.delete({
        where: { id: existing.accountId },
      })
    })

    await logAudit({
      organizationId: existing.organizationId,
      action: "DELETE",
      entity: "Investment",
      entityId: id,
      oldData: existing,
    })

    revalidatePath("/investasi")
    revalidatePath("/bank")
    revalidatePath("/laporan/bank")
    revalidatePath("/akun")
    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Gagal menghapus investasi"
    return { success: false, error: errorMessage }
  }
}

export async function inkasoInvestment(formData: FormData) {
  const { user } = await requireCurrentOrganization()

  // Permission check: hanya ADMIN, MANAGER yang bisa inkaso investasi
  if (!hasModulePermission(user, "investments")) {
    throw new Error("Anda tidak memiliki izin untuk melakukan inkaso investasi.")
  }

  const investmentId = formData.get("investmentId") as string
  const settlementBankAccountId = formData.get("settlementBankAccountId") as string
  const settlementDate = new Date(formData.get("settlementDate") as string)
  const settlementAmount = parseFloat(formData.get("settlementAmount") as string)
  const adjustmentAccountId = (formData.get("adjustmentAccountId") as string) || null
  const notes = formData.get("notes") as string

  if (!investmentId || !settlementBankAccountId || Number.isNaN(settlementAmount)) {
    throw new Error("Data inkaso tidak lengkap")
  }

  const investment = await prisma.investment.findUniqueOrThrow({
    where: { id: investmentId },
    include: {
      account: true,
      organization: true,
    },
  })

  if (investment.inkasoTransactionId) {
    throw new Error("Investasi ini sudah pernah diinkaso")
  }

  const bookValue = roundAmount(investment.currentValue || investment.purchaseAmount)
  const difference = roundAmount(settlementAmount - bookValue)

  if (difference !== 0 && !adjustmentAccountId) {
    throw new Error("Pilih akun penyesuaian laba/rugi investasi jika nominal inkaso berbeda dari nilai buku")
  }

  const reference = await generateNoteNumber({
    organizationId: investment.organizationId,
    code: "BKM",
  })

  const transaction = await prisma.$transaction(async (tx) => {
    const settlementBank = await tx.bankAccount.findUniqueOrThrow({
      where: { id: settlementBankAccountId },
    })

    const lines: Array<{ accountId: string; debit: number; credit: number; description?: string }> = [
      {
        accountId: settlementBank.accountId,
        debit: settlementAmount,
        credit: 0,
        description: `Inkaso investasi ${investment.name}`,
      },
      {
        accountId: investment.accountId,
        debit: 0,
        credit: bookValue,
        description: `Pelepasan investasi ${investment.name}`,
      },
    ]

    if (difference > 0 && adjustmentAccountId) {
      lines.push({
        accountId: adjustmentAccountId,
        debit: 0,
        credit: difference,
        description: `Keuntungan inkaso investasi ${investment.name}`,
      })
    }

    if (difference < 0 && adjustmentAccountId) {
      lines.push({
        accountId: adjustmentAccountId,
        debit: Math.abs(difference),
        credit: 0,
        description: `Kerugian inkaso investasi ${investment.name}`,
      })
    }

    const totalDebit = roundAmount(lines.reduce((sum, line) => sum + line.debit, 0))
    const totalCredit = roundAmount(lines.reduce((sum, line) => sum + line.credit, 0))

    if (totalDebit !== totalCredit) {
      throw new Error(`Jurnal inkaso tidak balance: debit ${totalDebit} dan kredit ${totalCredit}`)
    }

    const createdTransaction = await tx.transaction.create({
      data: {
        organizationId: investment.organizationId,
        date: settlementDate,
        reference,
        description: `Inkaso ${investment.name}`,
        lines: {
          create: lines,
        },
      },
    })

    await tx.investment.update({
      where: { id: investmentId },
      data: {
        settlementBankAccountId,
        inkasoTransactionId: createdTransaction.id,
        currentValue: settlementAmount,
        status: "LIQUIDATED",
        notes: notes || investment.notes,
      },
    })

    return createdTransaction
  })

  await logAudit({
    organizationId: investment.organizationId,
    action: "UPDATE",
    entity: "InvestmentInkaso",
    entityId: investmentId,
    newData: {
      transactionId: transaction.id,
      settlementAmount,
      reference,
    },
  })

  revalidatePath("/investasi")
  revalidatePath("/bank")
  revalidatePath("/laporan/bank")
  revalidatePath("/transaksi")
  revalidatePath("/laporan")

  return { success: true, transactionId: transaction.id, reference }
}
