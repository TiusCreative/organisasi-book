import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ensureOutboxSchema } from "@/lib/outbox-schema"
import { ensureStockBalanceSchema } from "@/lib/stock-balance-schema"

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
    await Promise.all([ensureStockBalanceSchema(), ensureOutboxSchema()])

    const body = (await request.json().catch(() => null)) as
      | {
          organizationId?: string
          sinceDays?: number
          adjustmentQtyThreshold?: number
          adjustmentCostThreshold?: number
          limit?: number
        }
      | null

    const organizationId = String(body?.organizationId || "").trim()
    if (!organizationId) throw new Error("organizationId wajib diisi")

    const sinceDays = Math.min(365, Math.max(1, Number(body?.sinceDays ?? 30)))
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000)
    const limit = Math.min(500, Math.max(1, Number(body?.limit ?? 200)))
    const adjustmentQtyThreshold = Math.max(0, Number(body?.adjustmentQtyThreshold ?? 1000))
    const adjustmentCostThreshold = Math.max(0, Number(body?.adjustmentCostThreshold ?? 10_000_000))

    const [negativeItems, negativeBalances, largeAdjustments, outboxByStatus] = await Promise.all([
      prisma.inventoryItem.findMany({
        where: { organizationId, quantity: { lt: 0 } },
        select: { id: true, code: true, name: true, warehouseId: true, quantity: true, updatedAt: true },
        orderBy: { quantity: "asc" },
        take: Math.min(200, limit),
      }),
      prisma.$queryRawUnsafe<Array<{ itemId: string; binId: string | null; lotBatchId: string | null; quantity: number }>>(
        `
          SELECT "itemId", "binId", "lotBatchId", "quantity"
          FROM "StockBalance"
          WHERE "organizationId" = $1 AND "quantity" < 0
          ORDER BY "quantity" ASC
          LIMIT $2
        `,
        organizationId,
        Math.min(200, limit),
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
        take: Math.min(200, limit),
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

    return NextResponse.json({
      ok: true,
      organizationId,
      since: since.toISOString(),
      thresholds: { adjustmentQtyThreshold, adjustmentCostThreshold },
      summary: {
        negativeItems: negativeItems.length,
        negativeBalances: negativeBalances.length,
        largeAdjustments: largeAdjustments.length,
      },
      negativeItems,
      negativeBalances,
      largeAdjustments,
      outbox,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ ok: false, error: message }, { status: message === "Unauthorized" ? 401 : 400 })
  }
}

