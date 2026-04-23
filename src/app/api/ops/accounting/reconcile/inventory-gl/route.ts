import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ensureInventoryAccountingSchema } from "@/lib/inventory-accounting-schema"
import { getInventoryAccountingConfigInTx } from "@/lib/inventory-accounting"

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

function parseDateOrUndefined(value?: unknown) {
  if (typeof value !== "string" || !value.trim()) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error(`Tanggal tidak valid: ${value}`)
  return date
}

export async function POST(request: Request) {
  try {
    requireOpsSecret(request)
    await ensureInventoryAccountingSchema()

    const body = (await request.json().catch(() => null)) as
      | { organizationId?: string; startDate?: string; endDate?: string; warehouseId?: string }
      | null

    const organizationId = String(body?.organizationId || "").trim()
    if (!organizationId) throw new Error("organizationId wajib diisi")

    const warehouseId = String(body?.warehouseId || "").trim() || undefined
    const startDate = parseDateOrUndefined(body?.startDate)
    const endDate = parseDateOrUndefined(body?.endDate)

    const result = await prisma.$transaction(async (tx) => {
      const cfg = await getInventoryAccountingConfigInTx(tx, organizationId)
      if (!cfg?.inventoryAccountId) {
        return { enabled: false as const, reason: "CONFIG_MISSING" as const }
      }

      const inv = await tx.inventoryItem.aggregate({
        where: { organizationId, status: "ACTIVE", ...(warehouseId ? { warehouseId } : {}) },
        _sum: { totalValue: true },
      })
      const inventoryValue = Number(inv._sum.totalValue || 0)

      const gl = await tx.transactionLine.aggregate({
        where: {
          accountId: cfg.inventoryAccountId,
          transaction: {
            organizationId,
            ...(startDate || endDate
              ? {
                  date: {
                    ...(startDate ? { gte: startDate } : {}),
                    ...(endDate ? { lte: endDate } : {}),
                  },
                }
              : {}),
          },
        },
        _sum: { debit: true, credit: true },
      })
      const debit = Number(gl._sum.debit || 0)
      const credit = Number(gl._sum.credit || 0)
      const glBalance = debit - credit

      return {
        enabled: true as const,
        inventoryAccountId: cfg.inventoryAccountId,
        inventoryValue,
        glBalance,
        difference: inventoryValue - glBalance,
      }
    })

    return NextResponse.json({
      ok: true,
      organizationId,
      filters: { startDate: startDate?.toISOString() ?? null, endDate: endDate?.toISOString() ?? null, warehouseId: warehouseId ?? null },
      result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ ok: false, error: message }, { status: message === "Unauthorized" ? 401 : 400 })
  }
}

