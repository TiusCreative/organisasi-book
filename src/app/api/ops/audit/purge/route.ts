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

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

export async function POST(request: Request) {
  try {
    requireOpsSecret(request)

    const body = (await request.json().catch(() => null)) as
      | {
          organizationId?: string
          allowAllOrganizations?: boolean
          dryRun?: boolean
          days?: number
        }
      | null

    const organizationId = String(body?.organizationId || "").trim() || undefined
    const allowAllOrganizations = Boolean(body?.allowAllOrganizations ?? false)
    const dryRun = Boolean(body?.dryRun ?? true)
    const days = Math.max(7, Math.min(3650, Number(body?.days ?? 365)))
    const before = daysAgo(days)

    if (!organizationId && !allowAllOrganizations) {
      throw new Error("Untuk purge global, set allowAllOrganizations=true atau isi organizationId")
    }

    const where = {
      ...(organizationId ? { organizationId } : {}),
      timestamp: { lt: before },
    }

    const counts = await prisma.auditLog.groupBy({
      by: ["action"],
      where,
      _count: { _all: true },
      orderBy: { _count: { _all: "desc" } },
    })

    const total = counts.reduce((sum, row) => sum + Number(row._count._all || 0), 0)

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        organizationId: organizationId ?? null,
        before: before.toISOString(),
        wouldDelete: { total, byAction: counts.map((c) => ({ action: c.action, count: c._count._all })) },
      })
    }

    const deleted = await prisma.auditLog.deleteMany({ where })

    return NextResponse.json({
      ok: true,
      dryRun: false,
      organizationId: organizationId ?? null,
      before: before.toISOString(),
      deleted: deleted.count,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ ok: false, error: message }, { status: message === "Unauthorized" ? 401 : 400 })
  }
}

