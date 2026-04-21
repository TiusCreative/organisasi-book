"use server"

import { prisma } from "../../lib/prisma" // Pastikan import ini ada
import { revalidatePath } from "next/cache"
import { generateNoteNumber } from "../../lib/nota-generator"
import { logAudit } from "../../lib/audit-logger"
import { calculatePPN, calculatePPh23 } from "../../lib/tax-utils"
import { syncTransactionTaxEntries } from "../../lib/tax-entries"
import { requireCurrentOrganization } from "../../lib/auth"
import { hasModulePermission } from "../../lib/permissions"

function roundAmount(value: number) {
  return Math.round(value * 100) / 100
}

function normalizeName(value: string | null | undefined) {
  return (value || "").toLowerCase().replace(/\s+/g, " ").trim()
}

function resolveTaxAccountId(
  accounts: Array<{ id: string; code: string; name: string; type: string }>,
  kind: "PPN_INPUT" | "PPN_OUTPUT" | "PPH23_PAYABLE"
) {
  if (kind === "PPN_INPUT") {
    return (
      accounts.find((account) => account.code === "1410")?.id ??
      accounts.find((account) => {
        const name = normalizeName(account.name)
        return account.type === "Asset" && (name.includes("ppn masukan") || name.includes("pajak dibayar dimuka"))
      })?.id
    )
  }

  if (kind === "PPN_OUTPUT") {
    return (
      accounts.find((account) => account.code === "2130")?.id ??
      accounts.find((account) => {
        const name = normalizeName(account.name)
        return account.type === "Liability" && (name.includes("hutang ppn") || name.includes("ppn keluaran"))
      })?.id
    )
  }

  return (
    accounts.find((account) => account.code === "2120")?.id ??
    accounts.find((account) => {
      const name = normalizeName(account.name)
      return account.type === "Liability" && (name.includes("pph 23") || name.includes("hutang pph"))
    })?.id
  )
}

function buildTransactionLines(
  amount: number,
  type: string,
  bankAccountId: string,
  categoryAccountId: string,
  accounts: Array<{ id: string; code: string; name: string; type: string }>,
  options: {
    applyPPN: boolean
    includeTax: boolean
    applyPPh23: boolean
  }
) {
  const lines: Array<{ accountId: string; debit: number; credit: number }> = []
  const ppnResult = options.applyPPN
    ? calculatePPN(amount, 0.12, options.includeTax)
    : { base: amount, tax: 0, total: amount }
  const pph23Amount = options.applyPPh23 ? calculatePPh23(ppnResult.base).pph23 : 0

  if (type === "OUT") {
    lines.push(
      {
        accountId: categoryAccountId,
        debit: ppnResult.base,
        credit: 0,
      }
    )

    if (ppnResult.tax > 0) {
      const ppnInputAccountId = resolveTaxAccountId(accounts, "PPN_INPUT")
      if (!ppnInputAccountId) {
        throw new Error("Akun PPN Masukan belum tersedia. Inisialisasi akun default terlebih dahulu.")
      }

      lines.push({
        accountId: ppnInputAccountId,
        debit: ppnResult.tax,
        credit: 0,
      })
    }

    if (pph23Amount > 0) {
      const pph23PayableAccountId = resolveTaxAccountId(accounts, "PPH23_PAYABLE")
      if (!pph23PayableAccountId) {
        throw new Error("Akun Hutang PPh 23 belum tersedia. Inisialisasi akun default terlebih dahulu.")
      }

      lines.push({
        accountId: pph23PayableAccountId,
        debit: 0,
        credit: pph23Amount,
      })
    }

    lines.push({
      accountId: bankAccountId,
      debit: 0,
      credit: roundAmount(ppnResult.total - pph23Amount),
    })
  } else {
    lines.push({
      accountId: bankAccountId,
      debit: ppnResult.total,
      credit: 0,
    })

    lines.push({
      accountId: categoryAccountId,
      debit: 0,
      credit: ppnResult.base,
    })

    if (ppnResult.tax > 0) {
      const ppnOutputAccountId = resolveTaxAccountId(accounts, "PPN_OUTPUT")
      if (!ppnOutputAccountId) {
        throw new Error("Akun Hutang PPN belum tersedia. Inisialisasi akun default terlebih dahulu.")
      }

      lines.push({
        accountId: ppnOutputAccountId,
        debit: 0,
        credit: ppnResult.tax,
      })
    }
  }

  return {
    lines,
    baseAmount: roundAmount(ppnResult.base),
    ppnAmount: roundAmount(ppnResult.tax),
    pph23Amount: roundAmount(pph23Amount),
    finalAmount: type === "OUT" ? roundAmount(ppnResult.total - pph23Amount) : roundAmount(ppnResult.total),
  }
}

function validateBalancedLines(lines: Array<{ debit: number; credit: number }>) {
  const totalDebit = roundAmount(lines.reduce((sum, line) => sum + line.debit, 0))
  const totalCredit = roundAmount(lines.reduce((sum, line) => sum + line.credit, 0))

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Jurnal transaksi tidak balance: debit ${totalDebit} dan kredit ${totalCredit}`)
  }
}

// FUNGSI SIMPAN TRANSAKSI
export async function createTransaction(formData: FormData) {
  const { user, organization } = await requireCurrentOrganization()

  // Permission check: hanya ADMIN, MANAGER, STAFF yang bisa membuat transaksi
  if (!hasModulePermission(user, "transactions")) {
    throw new Error("Anda tidak memiliki izin untuk membuat transaksi.")
  }

  const orgId = organization.id
  const description = formData.get("description") as string
  const amount = parseFloat(formData.get("amount") as string)
  const type = formData.get("type") as string // "IN" atau "OUT"
  const bankAccountId = formData.get("bankAccountId") as string
  const categoryAccountId = formData.get("categoryAccountId") as string
  const applyPPN = formData.get("applyPPN") === "on"
  const includeTax = formData.get("includeTax") === "on"
  const applyPPh23 = type === "OUT" && formData.get("applyPPh23") === "on"

  // Validasi sederhana agar tidak error jika data kosong
  if (!bankAccountId || !categoryAccountId || isNaN(amount)) {
    throw new Error("Data transaksi tidak lengkap")
  }

  const orgWithAccounts = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      accounts: {
        select: { id: true, code: true, name: true, type: true },
      },
    },
  })

  if (!orgWithAccounts) {
    throw new Error("Organisasi tidak ditemukan")
  }

  const transactionJournal = buildTransactionLines(
    amount,
    type,
    bankAccountId,
    categoryAccountId,
    orgWithAccounts.accounts,
    { applyPPN, includeTax, applyPPh23 }
  )
  validateBalancedLines(transactionJournal.lines)
  const reference = await generateNoteNumber({
    organizationId: orgId,
    code: type === "IN" ? "BKM" : "BKK",
  })
  const transactionDate = new Date()

  const transaction = await prisma.$transaction(async (tx) => {
    const createdTransaction = await tx.transaction.create({
      data: {
        organizationId: orgId,
        date: transactionDate,
        description,
        reference,
        lines: {
          create: transactionJournal.lines
        },
      }
    })

    await syncTransactionTaxEntries(tx, {
      organizationId: orgId,
      transactionId: createdTransaction.id,
      date: transactionDate,
      description,
      reference,
      baseAmount: transactionJournal.baseAmount,
      ppnAmount: transactionJournal.ppnAmount,
      pph23Amount: transactionJournal.pph23Amount,
    })

    return createdTransaction
  })

  await logAudit({
    organizationId: orgId,
    action: "CREATE",
    entity: "Transaction",
    entityId: transaction.id,
    newData: {
      description,
      amount,
      type,
      applyPPN,
      includeTax,
      applyPPh23,
      taxBase: transactionJournal.baseAmount,
      ppnAmount: transactionJournal.ppnAmount,
      pph23Amount: transactionJournal.pph23Amount,
      finalAmount: transactionJournal.finalAmount,
      bankAccountId,
      categoryAccountId,
      reference: transaction.reference,
    },
  })

  // Refresh data di halaman-halaman terkait
  revalidatePath("/")
  revalidatePath("/transaksi")
  revalidatePath("/laporan")
  revalidatePath("/pajak")
  
  return transaction
}

// FUNGSI EDIT TRANSAKSI
export async function updateTransaction(formData: FormData) {
  const { user } = await requireCurrentOrganization()

  // Permission check: hanya ADMIN, MANAGER, STAFF yang bisa edit transaksi
  if (!hasModulePermission(user, "transactions")) {
    throw new Error("Anda tidak memiliki izin untuk mengubah transaksi.")
  }

  const id = formData.get("id") as string
  const existingTransaction = await prisma.transaction.findUnique({
    where: { id },
    include: { lines: true }
  })
  const description = formData.get("description") as string
  const amount = parseFloat(formData.get("amount") as string)
  const type = formData.get("type") as string
  const bankAccountId = formData.get("bankAccountId") as string
  const categoryAccountId = formData.get("categoryAccountId") as string
  const applyPPN = formData.get("applyPPN") === "on"
  const includeTax = formData.get("includeTax") === "on"
  const applyPPh23 = type === "OUT" && formData.get("applyPPh23") === "on"

  if (!id || !bankAccountId || !categoryAccountId || isNaN(amount)) {
    throw new Error("Data transaksi tidak lengkap")
  }

  if (!existingTransaction) {
    throw new Error("Transaksi tidak ditemukan")
  }

  const orgWithAccounts = await prisma.organization.findUnique({
    where: { id: existingTransaction.organizationId },
    include: {
      accounts: {
        select: { id: true, code: true, name: true, type: true },
      },
    },
  })

  if (!orgWithAccounts) {
    throw new Error("Organisasi tidak ditemukan")
  }

  const transactionJournal = buildTransactionLines(
    amount,
    type,
    bankAccountId,
    categoryAccountId,
    orgWithAccounts.accounts,
    { applyPPN, includeTax, applyPPh23 }
  )
  validateBalancedLines(transactionJournal.lines)

  await prisma.$transaction(async (tx) => {
    await tx.transactionLine.deleteMany({
      where: { transactionId: id }
    })

    const updatedTransaction = await tx.transaction.update({
      where: { id },
      data: {
        description,
        date: existingTransaction.date,
        lines: {
          create: transactionJournal.lines
        },
      }
    })

    await syncTransactionTaxEntries(tx, {
      organizationId: existingTransaction.organizationId,
      transactionId: updatedTransaction.id,
      date: existingTransaction.date,
      description,
      reference: existingTransaction.reference,
      baseAmount: transactionJournal.baseAmount,
      ppnAmount: transactionJournal.ppnAmount,
      pph23Amount: transactionJournal.pph23Amount,
    })
  })

  revalidatePath("/transaksi")
  revalidatePath("/")
  revalidatePath("/laporan")
  revalidatePath("/pajak")

  if (existingTransaction) {
    await logAudit({
      organizationId: existingTransaction.organizationId,
      action: "UPDATE",
      entity: "Transaction",
      entityId: id,
      oldData: existingTransaction,
      newData: {
        description,
        amount,
        type,
        applyPPN,
        includeTax,
        applyPPh23,
        taxBase: transactionJournal.baseAmount,
        ppnAmount: transactionJournal.ppnAmount,
        pph23Amount: transactionJournal.pph23Amount,
        finalAmount: transactionJournal.finalAmount,
        bankAccountId,
        categoryAccountId,
      },
    })
  }
}

// FUNGSI HAPUS TRANSAKSI
export async function deleteTransaction(id: string) {
  try {
    const { user, organization } = await requireCurrentOrganization()

    // Permission check: hanya ADMIN yang bisa hapus transaksi
    if (user.role !== "ADMIN") {
      throw new Error("Anda tidak memiliki izin untuk menghapus transaksi. Hanya admin yang dapat menghapus.")
    }

    const existingTransaction = await prisma.transaction.findUnique({
      where: { id },
      include: { lines: true }
    })

    if (!existingTransaction) {
      throw new Error("Transaksi tidak ditemukan")
    }

    // Cek period lock
    const lockCheck = await isPeriodLocked(organization.id, existingTransaction.date)
    if (lockCheck.locked) {
      throw new Error(
        `Periode ${existingTransaction.date.getFullYear()}-${existingTransaction.date.getMonth() + 1} sudah dikunci. Hubungi admin untuk membuka periode ini.`
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.taxEntry.deleteMany({
        where: { transactionId: id },
      })

      await tx.transaction.delete({
        where: { id }
      })
    })

    if (existingTransaction) {
      await logAudit({
        organizationId: existingTransaction.organizationId,
        action: "DELETE",
        entity: "Transaction",
        entityId: id,
        oldData: existingTransaction,
      })
    }
    
    revalidatePath("/transaksi")
    revalidatePath("/")
    revalidatePath("/laporan")
    revalidatePath("/pajak")
    return { success: true }
  } catch {
    return { success: false, error: "Gagal menghapus transaksi" }
  }
}
