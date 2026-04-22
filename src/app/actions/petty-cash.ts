"use server"

import { prisma } from "@/lib/prisma"
import { requireCurrentOrganization } from "@/lib/auth"
import { revalidatePath } from "next/cache"

export async function getPettyCashAccounts(organizationId: string) {
  const { organization } = await requireCurrentOrganization()
  if (!organization || organization.id !== organizationId) {
    throw new Error("Unauthorized")
  }

  const pettyCashAccounts = await prisma.pettyCash.findMany({
    where: { organizationId },
    include: {
      currency: true,
      custodian: true,
      _count: {
        select: { transactions: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  return pettyCashAccounts
}

export async function createPettyCash(data: {
  organizationId: string
  name: string
  code: string
  currencyId: string
  fundType: "IMPREST" | "FLUKTUASI"
  initialAmount: number
  custodianId?: string
  location?: string
  notes?: string
}) {
  const { organization } = await requireCurrentOrganization()
  if (!organization || organization.id !== data.organizationId) {
    throw new Error("Unauthorized")
  }

  const pettyCash = await prisma.pettyCash.create({
    data: {
      organizationId: data.organizationId,
      name: data.name,
      code: data.code,
      currencyId: data.currencyId,
      fundType: data.fundType,
      initialAmount: data.initialAmount,
      currentAmount: data.initialAmount,
      custodianId: data.custodianId,
      location: data.location,
      notes: data.notes
    }
  })

  revalidatePath("/bank")
  return pettyCash
}

export async function getPettyCashTransactions(pettyCashId: string) {
  const { user } = await requireCurrentOrganization()
  if (!user?.id) {
    throw new Error("Unauthorized")
  }

  const transactions = await prisma.pettyCashTransaction.findMany({
    where: { pettyCashId },
    orderBy: { createdAt: 'desc' }
  })

  return transactions
}

export async function createPettyCashTransaction(data: {
  pettyCashId: string
  transactionType: "REPLENISH" | "DISBURSEMENT" | "ADJUSTMENT"
  amount: number
  description: string
  reference?: string
  accountId?: string
}) {
  const { user } = await requireCurrentOrganization()
  if (!user?.id) {
    throw new Error("Unauthorized")
  }

  const pettyCash = await prisma.pettyCash.findUnique({
    where: { id: data.pettyCashId }
  })

  if (!pettyCash) {
    throw new Error("Petty cash account not found")
  }

  // Update petty cash balance
  let newAmount = pettyCash.currentAmount
  if (data.transactionType === "REPLENISH") {
    newAmount += data.amount
  } else if (data.transactionType === "DISBURSEMENT") {
    newAmount -= data.amount
  } else if (data.transactionType === "ADJUSTMENT") {
    newAmount = data.amount
  }

  const transaction = await prisma.$transaction(async (tx) => {
    const created = await tx.pettyCashTransaction.create({
      data: {
        pettyCashId: data.pettyCashId,
        transactionType: data.transactionType,
        amount: data.amount,
        description: data.description,
        reference: data.reference,
        accountId: data.accountId,
        approvedBy: user.id,
        approvedAt: new Date()
      }
    })

    await tx.pettyCash.update({
      where: { id: data.pettyCashId },
      data: { currentAmount: newAmount }
    })

    return created
  })

  revalidatePath("/bank")
  return transaction
}
