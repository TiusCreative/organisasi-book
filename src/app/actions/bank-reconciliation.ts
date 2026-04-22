"use server"

import { prisma } from "@/lib/prisma"
import { requireCurrentOrganization } from "@/lib/auth"
import { revalidatePath } from "next/cache"

export async function getBankReconciliations(organizationId: string) {
  const { organization } = await requireCurrentOrganization()
  if (!organization || organization.id !== organizationId) {
    throw new Error("Unauthorized")
  }

  const reconciliations = await prisma.bankReconciliation.findMany({
    where: { organizationId },
    include: {
      bankAccount: {
        include: { account: true }
      },
      items: true
    },
    orderBy: { reconciliationDate: 'desc' }
  })

  return reconciliations
}

export async function createBankReconciliation(data: {
  organizationId: string
  bankAccountId: string
  reconciliationDate: Date
  statementBalance: number
  bookBalance: number
  notes?: string
}) {
  const { organization } = await requireCurrentOrganization()
  if (!organization || organization.id !== data.organizationId) {
    throw new Error("Unauthorized")
  }

  const difference = data.statementBalance - data.bookBalance

  const reconciliation = await prisma.bankReconciliation.create({
    data: {
      organizationId: data.organizationId,
      bankAccountId: data.bankAccountId,
      reconciliationDate: data.reconciliationDate,
      statementBalance: data.statementBalance,
      bookBalance: data.bookBalance,
      difference,
      notes: data.notes,
      status: "PENDING",
      reconciledBy: organization.id,
      reconciledAt: new Date()
    }
  })

  revalidatePath("/bank")
  revalidatePath("/laporan/bank")
  return reconciliation
}

export async function updateBankReconciliationStatus(id: string, status: "PENDING" | "RECONCILED") {
  const { user } = await requireCurrentOrganization()
  if (!user?.id) {
    throw new Error("Unauthorized")
  }

  const reconciliation = await prisma.bankReconciliation.findUnique({
    where: { id }
  })

  if (!reconciliation) {
    throw new Error("Reconciliation not found")
  }

  const updated = await prisma.bankReconciliation.update({
    where: { id },
    data: {
      status,
      reconciledBy: user.id,
      reconciledAt: new Date()
    }
  })

  revalidatePath("/bank")
  revalidatePath("/laporan/bank")
  return updated
}

export async function getBankAccounts(organizationId: string) {
  const { organization } = await requireCurrentOrganization()
  if (!organization || organization.id !== organizationId) {
    throw new Error("Unauthorized")
  }

  const bankAccounts = await prisma.bankAccount.findMany({
    where: { 
      organizationId,
      status: "ACTIVE"
    },
    include: {
      account: true,
      currency: true
    }
  })

  return bankAccounts
}
