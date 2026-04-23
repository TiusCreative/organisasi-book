import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ensureOutboxSchema } from "@/lib/outbox-schema"
import { ensureStockBalanceSchema } from "@/lib/stock-balance-schema"
import { ensureInventoryAccountingSchema } from "@/lib/inventory-accounting-schema"
import { getInventoryAccountingConfigInTx } from "@/lib/inventory-accounting"
import { publishPendingOutboxEvents } from "@/lib/outbox"

export const dynamic = "force-dynamic"

function requireOpsSecret(request: Request) {
  const expected = process.env.OPS_SECRET
  if (!expected) {
    throw new Error("OPS_SECRET belum diset")
  }
  const provided = request.headers.get("x-ops-secret") || ""
  if (provided !== expected) {
    throw new Error("Unauthorized")
  }
}

export async function POST(request: Request) {
  try {
    requireOpsSecret(request)
    await Promise.all([ensureStockBalanceSchema(), ensureOutboxSchema(), ensureInventoryAccountingSchema()])

    const body = (await request.json().catch(() => null)) as
      | {
          organizationId?: string
          publishOutbox?: boolean
          outboxBatchSize?: number
          reconcileThreshold?: number
          sinceDays?: number
          adjustmentQtyThreshold?: number
          adjustmentCostThreshold?: number
        }
      | null

    const organizationId = String(body?.organizationId || "").trim()
    if (!organizationId) throw new Error("organizationId wajib diisi")

    const reconcileThreshold = Math.max(0, Number(body?.reconcileThreshold ?? 0))
    const sinceDays = Math.min(365, Math.max(1, Number(body?.sinceDays ?? 30)))
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000)
    const adjustmentQtyThreshold = Math.max(0, Number(body?.adjustmentQtyThreshold ?? 1000))
    const adjustmentCostThreshold = Math.max(0, Number(body?.adjustmentCostThreshold ?? 10_000_000))
    const publishOutbox = Boolean(body?.publishOutbox ?? true)
    const outboxBatchSize = Math.max(1, Math.min(200, Number(body?.outboxBatchSize ?? 50)))

    const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true } })
    if (!org) throw new Error("Organization tidak ditemukan")

    const [reconcile, anomalies, invgl, outboxRun] = await Promise.all([
      // Reconcile StockBalance (bin/lot) vs InventoryItem.quantity
      (async () => {
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
          .filter((row) => row.missingItem || row.absDiff > reconcileThreshold)
          .sort((a, b) => b.absDiff - a.absDiff)
          .slice(0, 200)

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
      })(),

      // Anomalies snapshot
      (async () => {
        const [negativeItems, negativeBalances, largeAdjustments, outboxByStatus] = await Promise.all([
          prisma.inventoryItem.findMany({
            where: { organizationId, quantity: { lt: 0 } },
            select: { id: true, code: true, name: true, warehouseId: true, quantity: true, updatedAt: true },
            orderBy: { quantity: "asc" },
            take: 200,
          }),
          prisma.$queryRawUnsafe<
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
          ),
          prisma.inventoryMovement.findMany({
            where: {
              organizationId,
              movementType: "ADJUSTMENT",
              createdAt: { gte: since },
              OR: [
                ...(adjustmentQtyThreshold > 0 ? [{ quantity: { gte: adjustmentQtyThreshold } }] : []),
                ...(adjustmentCostThreshold > 0 ? [{ totalCost: { gte: adjustmentCostThreshold } }] : []),
              ],
            },
            select: {
              id: true,
              itemId: true,
              movementType: true,
              quantity: true,
              unitCost: true,
              totalCost: true,
              reference: true,
              description: true,
              performedBy: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 200,
          }),
          prisma.$queryRawUnsafe<Array<{ status: string; count: number; oldestCreatedAt: Date | null }>>(
            `
              SELECT
                "status" as status,
                COUNT(*)::int as count,
                MIN("createdAt") as "oldestCreatedAt"
              FROM "OutboxEvent"
              WHERE "organizationId" = $1
              GROUP BY "status"
            `,
            organizationId,
          ),
        ])

        const outbox = outboxByStatus.reduce(
          (acc, row) => {
            acc[row.status] = {
              count: Number(row.count || 0),
              oldestCreatedAt: row.oldestCreatedAt ? row.oldestCreatedAt.toISOString() : null,
            }
            return acc
          },
          {} as Record<string, { count: number; oldestCreatedAt: string | null }>,
        )

        return { since: since.toISOString(), negativeItems, negativeBalances, largeAdjustments, outbox }
      })(),

      // Inventory vs GL
      prisma.$transaction(async (tx) => {
        const cfg = await getInventoryAccountingConfigInTx(tx, organizationId)
        if (!cfg?.inventoryAccountId) {
          return { enabled: false as const, reason: "CONFIG_MISSING" as const }
        }

        const inv = await tx.inventoryItem.aggregate({
          where: { organizationId, status: "ACTIVE" },
          _sum: { totalValue: true },
        })
        const inventoryValue = Number(inv._sum.totalValue || 0)

        const gl = await tx.transactionLine.aggregate({
          where: {
            accountId: cfg.inventoryAccountId,
            transaction: { organizationId },
          },
          _sum: { debit: true, credit: true },
        })
        const glBalance = Number(gl._sum.debit || 0) - Number(gl._sum.credit || 0)

        return { enabled: true as const, inventoryAccountId: cfg.inventoryAccountId, inventoryValue, glBalance, difference: inventoryValue - glBalance }
      }),

      publishOutbox ? publishPendingOutboxEvents({ batchSize: outboxBatchSize }) : Promise.resolve(null),
    ])

    return NextResponse.json({
      ok: true,
      organizationId: org.id,
      organizationName: org.name,
      thresholds: { reconcileThreshold, sinceDays, adjustmentQtyThreshold, adjustmentCostThreshold },
      outboxPublish: outboxRun,
      reconcile,
      anomalies,
      inventoryVsGL: invgl,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ ok: false, error: message }, { status: message === "Unauthorized" ? 401 : 400 })
  }
}

