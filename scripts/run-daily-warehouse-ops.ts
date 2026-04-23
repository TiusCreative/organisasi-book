import { prisma } from "../src/lib/prisma"

function normalizeText(value?: string) {
  const trimmed = (value ?? "").trim()
  return trimmed.length ? trimmed : undefined
}

function parseNumber(value: unknown, fallback: number) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

async function listOrganizations(organizationId?: string) {
  if (organizationId) {
    const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true } })
    if (!org) throw new Error("Organization tidak ditemukan")
    return [org]
  }

  return prisma.organization.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
    take: 10_000,
  })
}

async function reconcileStockBalanceVsItemQty(organizationId: string, threshold: number) {
  const balanceRows = await prisma.$queryRawUnsafe<Array<{ itemId: string; balanceQty: number }>>(
    `
      SELECT "itemId", COALESCE(SUM("quantity"), 0)::double precision AS "balanceQty"
      FROM "StockBalance"
      WHERE "organizationId" = $1
      GROUP BY "itemId"
    `,
    organizationId,
  )

  const itemIds = balanceRows.map((r) => r.itemId)
  const items = itemIds.length
    ? await prisma.inventoryItem.findMany({
        where: { organizationId, id: { in: itemIds } },
        select: { id: true, code: true, name: true, quantity: true, warehouseId: true, status: true },
      })
    : []
  const itemById = new Map(items.map((it) => [it.id, it]))

  const mismatches = balanceRows
    .map((row) => {
      const item = itemById.get(row.itemId)
      const itemQty = Number(item?.quantity || 0)
      const balanceQty = Number(row.balanceQty || 0)
      const diff = balanceQty - itemQty
      return {
        itemId: row.itemId,
        itemCode: item?.code || null,
        itemName: item?.name || null,
        warehouseId: item?.warehouseId || null,
        itemStatus: item?.status || null,
        itemQty,
        balanceQty,
        diff,
        absDiff: Math.abs(diff),
        missingItem: !item,
      }
    })
    .filter((row) => row.missingItem || row.absDiff > threshold)
    .sort((a, b) => b.absDiff - a.absDiff)

  const negativeBalances = await prisma.$queryRawUnsafe<
    Array<{ itemId: string; binId: string | null; lotBatchId: string | null; quantity: number }>
  >(
    `
      SELECT "itemId", "binId", "lotBatchId", "quantity"
      FROM "StockBalance"
      WHERE "organizationId" = $1 AND "quantity" < 0
      ORDER BY "quantity" ASC
      LIMIT 200
    `,
    organizationId,
  )

  return { mismatches, negativeBalances }
}

async function reconcileInventoryVsGL(organizationId: string) {
  const cfg = await prisma.$queryRawUnsafe<Array<{ inventoryAccountId: string | null }>>(
    `SELECT "inventoryAccountId" FROM "InventoryAccountingConfig" WHERE "organizationId" = $1 LIMIT 1`,
    organizationId,
  )
  const inventoryAccountId = cfg[0]?.inventoryAccountId ?? null
  if (!inventoryAccountId) return { enabled: false as const, reason: "CONFIG_MISSING" as const }

  const inv = await prisma.inventoryItem.aggregate({
    where: { organizationId, status: "ACTIVE" },
    _sum: { totalValue: true },
  })
  const inventoryValue = Number(inv._sum.totalValue || 0)

  const gl = await prisma.transactionLine.aggregate({
    where: { accountId: inventoryAccountId, transaction: { organizationId } },
    _sum: { debit: true, credit: true },
  })
  const glBalance = Number(gl._sum.debit || 0) - Number(gl._sum.credit || 0)

  return { enabled: true as const, inventoryAccountId, inventoryValue, glBalance, difference: inventoryValue - glBalance }
}

async function getWarehouseAnomalies(organizationId: string, input: { sinceDays: number; adjustmentQtyThreshold: number; adjustmentCostThreshold: number }) {
  const since = new Date(Date.now() - input.sinceDays * 24 * 60 * 60 * 1000)

  const [negativeItems, negativeBalances, largeAdjustments, outboxByStatus] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { organizationId, quantity: { lt: 0 } },
      select: { id: true, code: true, name: true, warehouseId: true, quantity: true, updatedAt: true },
      orderBy: { quantity: "asc" },
      take: 200,
    }),
    prisma.$queryRawUnsafe<Array<{ itemId: string; binId: string | null; lotBatchId: string | null; quantity: number }>>(
      `
        SELECT "itemId", "binId", "lotBatchId", "quantity"
        FROM "StockBalance"
        WHERE "organizationId" = $1 AND "quantity" < 0
        ORDER BY "quantity" ASC
        LIMIT 200
      `,
      organizationId,
    ),
    prisma.inventoryMovement.findMany({
      where: {
        organizationId,
        movementType: "ADJUSTMENT",
        createdAt: { gte: since },
        OR: [
          ...(input.adjustmentQtyThreshold > 0 ? [{ quantity: { gte: input.adjustmentQtyThreshold } }] : []),
          ...(input.adjustmentCostThreshold > 0 ? [{ totalCost: { gte: input.adjustmentCostThreshold } }] : []),
        ],
      },
      select: { id: true, itemId: true, quantity: true, unitCost: true, totalCost: true, reference: true, performedBy: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.$queryRawUnsafe<Array<{ status: string; count: number }>>(
      `
        SELECT "status" as status, COUNT(*)::int as count
        FROM "OutboxEvent"
        WHERE "organizationId" = $1
        GROUP BY "status"
      `,
      organizationId,
    ),
  ])

  const outbox = outboxByStatus.reduce((acc, row) => {
    acc[row.status] = Number(row.count || 0)
    return acc
  }, {} as Record<string, number>)

  return { since: since.toISOString(), negativeItems, negativeBalances, largeAdjustments, outbox }
}

async function run() {
  const organizationId = normalizeText(process.env.OPS_ORG_ID)
  const threshold = parseNumber(process.env.OPS_RECONCILE_THRESHOLD, 0)
  const sinceDays = Math.max(1, Math.min(365, parseNumber(process.env.OPS_SINCE_DAYS, 30)))
  const adjustmentQtyThreshold = Math.max(0, parseNumber(process.env.OPS_ADJ_QTY_THRESHOLD, 1000))
  const adjustmentCostThreshold = Math.max(0, parseNumber(process.env.OPS_ADJ_COST_THRESHOLD, 10_000_000))

  const organizations = await listOrganizations(organizationId)
  const results: Array<{
    organizationId: string
    name: string
    mismatches: number
    negativeBalances: number
    negativeItems: number
    largeAdjustments: number
    outboxPending: number
    outboxDead: number
    invGlDiff: number | null
  }> = []

  for (const org of organizations) {
    const reconcile = await reconcileStockBalanceVsItemQty(org.id, threshold)
    const anomalies = await getWarehouseAnomalies(org.id, { sinceDays, adjustmentQtyThreshold, adjustmentCostThreshold })
    const invgl = await reconcileInventoryVsGL(org.id)

    results.push({
      organizationId: org.id,
      name: org.name,
      mismatches: reconcile.mismatches.length,
      negativeBalances: reconcile.negativeBalances.length,
      negativeItems: anomalies.negativeItems.length,
      largeAdjustments: anomalies.largeAdjustments.length,
      outboxPending: anomalies.outbox.PENDING ?? 0,
      outboxDead: anomalies.outbox.DEAD_LETTER ?? 0,
      invGlDiff: invgl.enabled ? invgl.difference : null,
    })
  }

  console.table(results)
}

run()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

