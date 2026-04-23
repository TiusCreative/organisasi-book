import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

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

function csvEscape(value: unknown) {
  const str = value === null || value === undefined ? "" : String(value)
  const escaped = str.replaceAll(`"`, `""`)
  return `"${escaped}"`
}

export async function POST(request: Request) {
  try {
    requireOpsSecret(request)

    const body = (await request.json().catch(() => null)) as
      | {
          organizationId?: string
          start?: string
          end?: string
          action?: string
          entity?: string
          entityId?: string
          userId?: string
          status?: string
          limit?: number
          format?: "json" | "csv"
          includeData?: boolean
        }
      | null

    const organizationId = String(body?.organizationId || "").trim()
    if (!organizationId) throw new Error("organizationId wajib diisi")

    const start = parseDateOrUndefined(body?.start)
    const end = parseDateOrUndefined(body?.end)
    const limit = Math.min(20_000, Math.max(1, Number(body?.limit ?? 5_000)))
    const includeData = Boolean(body?.includeData ?? true)
    const format = (body?.format ?? "json") as "json" | "csv"

    const action = typeof body?.action === "string" && body.action.trim() ? body.action.trim() : undefined
    const entity = typeof body?.entity === "string" && body.entity.trim() ? body.entity.trim() : undefined
    const entityId = typeof body?.entityId === "string" && body.entityId.trim() ? body.entityId.trim() : undefined
    const userId = typeof body?.userId === "string" && body.userId.trim() ? body.userId.trim() : undefined
    const status = typeof body?.status === "string" && body.status.trim() ? body.status.trim() : undefined

    const rows = await prisma.auditLog.findMany({
      where: {
        organizationId,
        ...(action ? { action } : {}),
        ...(entity ? { entity } : {}),
        ...(entityId ? { entityId } : {}),
        ...(userId ? { userId } : {}),
        ...(status ? { status } : {}),
        ...(start || end
          ? {
              timestamp: {
                ...(start ? { gte: start } : {}),
                ...(end ? { lte: end } : {}),
              },
            }
          : {}),
      },
      orderBy: { timestamp: "desc" },
      take: limit,
      select: {
        id: true,
        organizationId: true,
        userId: true,
        action: true,
        entity: true,
        entityId: true,
        userName: true,
        userEmail: true,
        reason: true,
        ipAddress: true,
        userAgent: true,
        status: true,
        errorMessage: true,
        timestamp: true,
        oldData: true,
        newData: true,
        changes: true,
      },
    })

    if (format === "csv") {
      const headers = [
        "id",
        "organizationId",
        "timestamp",
        "action",
        "entity",
        "entityId",
        "userId",
        "userName",
        "userEmail",
        "status",
        "reason",
        "ipAddress",
        "userAgent",
        "errorMessage",
        ...(includeData ? ["oldData", "newData", "changes"] : []),
      ]

      const lines = [headers.map(csvEscape).join(",")]
      for (const row of rows) {
        lines.push(
          [
            row.id,
            row.organizationId,
            row.timestamp?.toISOString?.() ?? row.timestamp,
            row.action,
            row.entity,
            row.entityId,
            row.userId,
            row.userName,
            row.userEmail,
            row.status,
            row.reason,
            row.ipAddress,
            row.userAgent,
            row.errorMessage,
            ...(includeData ? [row.oldData, row.newData, row.changes] : []),
          ]
            .map(csvEscape)
            .join(","),
        )
      }

      return new NextResponse(lines.join("\n"), {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "cache-control": "no-store",
        },
      })
    }

    return NextResponse.json({
      ok: true,
      organizationId,
      count: rows.length,
      filters: { start: start?.toISOString() ?? null, end: end?.toISOString() ?? null, action, entity, entityId, userId, status, limit },
      rows: includeData ? rows : rows.map((row) => ({ ...row, oldData: null, newData: null, changes: null })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ ok: false, error: message }, { status: message === "Unauthorized" ? 401 : 400 })
  }
}
