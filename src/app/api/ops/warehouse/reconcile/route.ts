import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
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
    await ensureStockBalanceSchema()

    const body = (await request.json().catch(() => null)) as
      | { organizationId?: string; limit?: number; threshold?: number }
      | null

    const organizationId = String(body?.organizationId || "").trim()
    if (!organizationId) {
      throw new Error("organizationId wajib diisi")
    }

    const limit = Math.min(500, Math.max(1, Number(body?.limit ?? 200)))
    const threshold = Math.max(0, Number(body?.threshold ?? 0))

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
      .slice(0, limit)

    const negativeBalances = await prisma.$queryRawUnsafe<Array<{ itemId: string; binId: string | null; lotBatchId: string | null; quantity: number }>>(
      `
        SELECT "itemId", "binId", "lotBatchId", "quantity"
        FROM "StockBalance"
        WHERE "organizationId" = $1 AND "quantity" < 0
        ORDER BY "quantity" ASC
        LIMIT 200
      `,
      organizationId,
    )

    return NextResponse.json({
      ok: true,
      organizationId,
      summary: {
        trackedItems: balanceRows.length,
        mismatches: mismatches.length,
        negativeBalances: negativeBalances.length,
      },
      mismatches,
      negativeBalances,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ ok: false, error: message }, { status: message === "Unauthorized" ? 401 : 400 })
  }
}

