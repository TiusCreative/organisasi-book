import type { Prisma } from "@prisma/client"
import { createJournalInTx as createAccountingJournalInTx } from "@/lib/accounting/journal"
import { ensureInventoryAccountingSchema } from "@/lib/inventory-accounting-schema"

export type InventoryAccountingConfigRow = {
  organizationId: string
  inventoryAccountId: string | null
  wipAccountId: string | null
  finishedGoodsAccountId: string | null
  inventoryVarianceAccountId: string | null
  cogsAccountId: string | null
  updatedAt: Date
}

export async function getInventoryAccountingConfigInTx(
  tx: Prisma.TransactionClient,
  organizationId: string,
): Promise<InventoryAccountingConfigRow | null> {
  await ensureInventoryAccountingSchema()
  const rows = await tx.$queryRawUnsafe<InventoryAccountingConfigRow[]>(
    `SELECT * FROM "InventoryAccountingConfig" WHERE "organizationId" = $1 LIMIT 1`,
    organizationId,
  )
  return rows[0] || null
}

export async function upsertInventoryAccountingConfigInTx(
  tx: Prisma.TransactionClient,
  input: Omit<InventoryAccountingConfigRow, "updatedAt">,
) {
  await ensureInventoryAccountingSchema()
  await tx.$executeRawUnsafe(
    `
      INSERT INTO "InventoryAccountingConfig"
        ("organizationId","inventoryAccountId","wipAccountId","finishedGoodsAccountId","inventoryVarianceAccountId","cogsAccountId","updatedAt")
      VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP)
      ON CONFLICT ("organizationId") DO UPDATE
      SET "inventoryAccountId" = EXCLUDED."inventoryAccountId",
          "wipAccountId" = EXCLUDED."wipAccountId",
          "finishedGoodsAccountId" = EXCLUDED."finishedGoodsAccountId",
          "inventoryVarianceAccountId" = EXCLUDED."inventoryVarianceAccountId",
          "cogsAccountId" = EXCLUDED."cogsAccountId",
          "updatedAt" = CURRENT_TIMESTAMP
    `,
    input.organizationId,
    input.inventoryAccountId,
    input.wipAccountId,
    input.finishedGoodsAccountId,
    input.inventoryVarianceAccountId,
    input.cogsAccountId,
  )
}

export async function createJournalInTx(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string
    date?: Date
    description: string
    reference?: string
    lines: Array<{
      accountId: string
      debit?: number
      credit?: number
      description?: string
    }>
  },
) {
  return createAccountingJournalInTx(tx, {
    organizationId: input.organizationId,
    date: input.date,
    description: input.description,
    reference: input.reference || null,
    lines: input.lines,
    audit: {
      entity: "InventoryJournal",
    },
  })
}

export async function postWorkOrderIssueMaterialJournalInTx(
  tx: Prisma.TransactionClient,
  input: { organizationId: string; workOrderCode: string; amount: number },
) {
  const cfg = await getInventoryAccountingConfigInTx(tx, input.organizationId)
  if (!cfg?.inventoryAccountId || !cfg?.wipAccountId) return { posted: false, reason: "CONFIG_MISSING" as const }
  const amount = Number(input.amount || 0)
  if (amount <= 0) return { posted: false, reason: "ZERO" as const }

  await createJournalInTx(tx, {
    organizationId: input.organizationId,
    description: `WO Issue Material ${input.workOrderCode}`,
    reference: input.workOrderCode,
    lines: [
      { accountId: cfg.wipAccountId, debit: amount, description: "Dr WIP" },
      { accountId: cfg.inventoryAccountId, credit: amount, description: "Cr Inventory" },
    ],
  })

  return { posted: true }
}

export async function postWorkOrderCompleteJournalInTx(
  tx: Prisma.TransactionClient,
  input: { organizationId: string; workOrderCode: string; amount: number },
) {
  const cfg = await getInventoryAccountingConfigInTx(tx, input.organizationId)
  if (!cfg?.wipAccountId || !cfg?.finishedGoodsAccountId) return { posted: false, reason: "CONFIG_MISSING" as const }
  const amount = Number(input.amount || 0)
  if (amount <= 0) return { posted: false, reason: "ZERO" as const }

  await createJournalInTx(tx, {
    organizationId: input.organizationId,
    description: `WO Complete ${input.workOrderCode}`,
    reference: input.workOrderCode,
    lines: [
      { accountId: cfg.finishedGoodsAccountId, debit: amount, description: "Dr Finished Goods" },
      { accountId: cfg.wipAccountId, credit: amount, description: "Cr WIP" },
    ],
  })

  return { posted: true }
}

export async function postStockAdjustmentJournalInTx(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string
    movementId: string
    amount: number
    direction: "INCREASE" | "DECREASE"
    reference?: string
  },
) {
  const cfg = await getInventoryAccountingConfigInTx(tx, input.organizationId)
  if (!cfg?.inventoryAccountId || !cfg?.inventoryVarianceAccountId) {
    return { posted: false, reason: "CONFIG_MISSING" as const }
  }

  const amount = Number(input.amount || 0)
  if (amount <= 0) return { posted: false, reason: "ZERO" as const }

  const dedupeRef = `INVADJ:${input.movementId}`
  const exists = await tx.transaction.findFirst({
    where: { organizationId: input.organizationId, reference: dedupeRef },
    select: { id: true },
  })
  if (exists) return { posted: false, reason: "ALREADY_POSTED" as const }

  const directionLabel = input.direction === "INCREASE" ? "Increase" : "Decrease"
  await createJournalInTx(tx, {
    organizationId: input.organizationId,
    description: `Stock Adjustment ${directionLabel}${input.reference ? ` (${input.reference})` : ""}`,
    reference: dedupeRef,
    lines:
      input.direction === "INCREASE"
        ? [
            { accountId: cfg.inventoryAccountId, debit: amount, description: "Dr Inventory" },
            { accountId: cfg.inventoryVarianceAccountId, credit: amount, description: "Cr Inventory Variance" },
          ]
        : [
            { accountId: cfg.inventoryVarianceAccountId, debit: amount, description: "Dr Inventory Variance" },
            { accountId: cfg.inventoryAccountId, credit: amount, description: "Cr Inventory" },
          ],
  })

  return { posted: true }
}
