"use server"

import { prisma } from "../../lib/prisma"
import { revalidatePath } from "next/cache"
import { requireCurrentOrganization } from "../../lib/auth"
import { hasModulePermission } from "../../lib/permissions"

async function generateNextBankAccountCode(tx: Pick<typeof prisma, "chartOfAccount">, orgId: string) {
  const existingAccounts = await tx.chartOfAccount.findMany({
    where: {
      organizationId: orgId,
      type: "Asset",
      code: {
        startsWith: "11",
      },
    },
    select: { code: true },
  })

  const maxCode = existingAccounts.reduce((currentMax, account) => {
    const parsedCode = Number(account.code)
    return Number.isFinite(parsedCode) ? Math.max(currentMax, parsedCode) : currentMax
  }, 1100)

  return String(maxCode + 1)
}

// FUNGSI UNTUK MENAMBAH BANK BARU
export async function createBankAccount(formData: FormData) {
  const { user, organization } = await requireCurrentOrganization()

  // Permission check: hanya ADMIN, MANAGER yang bisa membuat rekening bank
  if (!hasModulePermission(user, "bank")) {
    throw new Error("Anda tidak memiliki izin untuk membuat rekening bank.")
  }

  const orgId = organization.id
  const bankName = formData.get("bankName") as string
  const accountName = formData.get("accountName") as string
  const accountNumber = formData.get("accountNumber") as string
  const openingBalance = parseFloat((formData.get("openingBalance") as string) || "0")

  if (!bankName || !accountName || !accountNumber) {
    throw new Error("Data rekening tidak lengkap")
  }

  await prisma.$transaction(async (tx) => {
    const nextCode = await generateNextBankAccountCode(tx, orgId)

    // 1. Buat Chart of Account (COA) otomatis untuk bank ini
    const coa = await tx.chartOfAccount.create({
      data: {
        organizationId: orgId,
        code: nextCode,
        name: `Bank - ${bankName} (${accountNumber.slice(-4)})`,
        type: "Asset",
      }
    })

    // 2. Buat detail BankAccount yang terhubung ke COA tadi
    await tx.bankAccount.create({
      data: {
        organizationId: orgId,
        accountId: coa.id,
        bankName,
        accountName,
        accountNumber,
        balance: Number.isFinite(openingBalance) ? openingBalance : 0,
      }
    })
  })

  revalidatePath("/bank")
  revalidatePath("/transaksi") // Agar pilihan di transaksi ikut update
  revalidatePath("/akun")
}

// FUNGSI UNTUK EDIT BANK
export async function updateBankAccount(formData: FormData) {
  const { user } = await requireCurrentOrganization()

  // Permission check: hanya ADMIN, MANAGER yang bisa edit rekening bank
  if (!hasModulePermission(user, "bank")) {
    throw new Error("Anda tidak memiliki izin untuk mengubah rekening bank.")
  }

  const id = formData.get("id") as string
  const bankName = formData.get("bankName") as string
  const accountNumber = formData.get("accountNumber") as string
  const accountName = formData.get("accountName") as string
  const balance = parseFloat((formData.get("balance") as string) || "0")

  if (!id || !bankName || !accountNumber || !accountName) {
    throw new Error("Data rekening tidak lengkap")
  }

  await prisma.$transaction(async (tx) => {
    const bank = await tx.bankAccount.findUniqueOrThrow({
      where: { id },
      include: { account: true }
    })

    await tx.bankAccount.update({
      where: { id },
      data: {
        bankName,
        accountNumber,
        accountName,
        balance: Number.isFinite(balance) ? balance : 0,
      }
    })

    await tx.chartOfAccount.update({
      where: { id: bank.accountId },
      data: {
        name: `Bank - ${bankName} (${accountNumber.slice(-4)})`,
      }
    })
  })

  revalidatePath("/bank")
  revalidatePath("/transaksi")
  revalidatePath("/akun")
}

// FUNGSI UNTUK RECONCILIATION BANK
export async function reconcileBankAccount(formData: FormData) {
  const { user } = await requireCurrentOrganization()

  // Permission check: hanya ADMIN, MANAGER yang bisa reconciliation
  if (!hasModulePermission(user, "bank")) {
    throw new Error("Anda tidak memiliki izin untuk melakukan rekonsiliasi bank.")
  }

  const bankAccountId = formData.get("bankAccountId") as string
  const newBalance = parseFloat(formData.get("newBalance") as string)
  const notes = formData.get("notes") as string

  if (!bankAccountId || isNaN(newBalance)) {
    throw new Error("Data reconciliation tidak lengkap")
  }

  await prisma.bankAccount.update({
    where: { id: bankAccountId },
    data: {
      balance: newBalance,
      lastReconciled: new Date(),
      notes: notes || undefined
    }
  })

  revalidatePath("/bank")
  revalidatePath("/transaksi")
}

// FUNGSI UNTUK UPDATE STATUS BANK (ACTIVE/INACTIVE)
export async function updateBankStatus(bankId: string, status: "ACTIVE" | "INACTIVE") {
  const { user } = await requireCurrentOrganization()

  // Permission check: hanya ADMIN, MANAGER yang bisa update status
  if (!hasModulePermission(user, "bank")) {
    throw new Error("Anda tidak memiliki izin untuk mengubah status rekening bank.")
  }

  if (!bankId || !["ACTIVE", "INACTIVE"].includes(status)) {
    throw new Error("Data tidak valid")
  }

  await prisma.bankAccount.update({
    where: { id: bankId },
    data: { status }
  })

  revalidatePath("/bank")
}

// FUNGSI UNTUK HAPUS BANK ACCOUNT
export async function deleteBankAccount(bankId: string) {
  try {
    const { user } = await requireCurrentOrganization()

    // Permission check: hanya ADMIN yang bisa hapus rekening bank
    if (user.role !== "ADMIN") {
      throw new Error("Anda tidak memiliki izin untuk menghapus rekening bank. Hanya admin yang dapat menghapus.")
    }

    const bank = await prisma.bankAccount.findUnique({
      where: { id: bankId },
      include: {
        account: true,
        sourceInvestments: true,
        settlementInvestments: true
      }
    })

    if (!bank) {
      throw new Error("Rekening bank tidak ditemukan")
    }

    // Check if bank is used in investments
    if (bank.sourceInvestments.length > 0 || bank.settlementInvestments.length > 0) {
      throw new Error("Tidak dapat menghapus rekening yang terhubung dengan investasi")
    }

    // Delete bank account and its associated COA
    await prisma.$transaction(async (tx) => {
      await tx.bankAccount.delete({
        where: { id: bankId }
      })

      await tx.chartOfAccount.delete({
        where: { id: bank.accountId }
      })
    })

    revalidatePath("/bank")
    revalidatePath("/transaksi")
    revalidatePath("/akun")
    return { success: true, message: "Rekening berhasil dihapus" }
  } catch (error) {
    console.error("Delete bank error:", error)
    const errorMessage = error instanceof Error ? error.message : "Gagal menghapus rekening"
    return { success: false, error: errorMessage }
  }
}
