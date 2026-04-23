import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ensureOutboxSchema } from "@/lib/outbox-schema"

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
    await ensureOutboxSchema()

    const body = (await request.json().catch(() => null)) as
      | { organizationId?: string; dryRun?: boolean; sentDays?: number; deadDays?: number }
      | null

    const organizationId = String(body?.organizationId || "").trim() || undefined
    const dryRun = Boolean(body?.dryRun ?? true)
    const sentDays = Math.max(1, Math.min(3650, Number(body?.sentDays ?? 30)))
    const deadDays = Math.max(1, Math.min(3650, Number(body?.deadDays ?? 180)))

    const sentBefore = daysAgo(sentDays)
    const deadBefore = daysAgo(deadDays)

    const whereOrg = organizationId ? `AND "organizationId" = $3` : ""

    const wouldSent = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
      `
        SELECT COUNT(*)::int as count
        FROM "OutboxEvent"
        WHERE "status" = 'SENT'
          AND "createdAt" < $1
          ${whereOrg}
      `,
      sentBefore,
      deadBefore,
      organizationId ?? null,
    )

    const wouldDead = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
      `
        SELECT COUNT(*)::int as count
        FROM "OutboxEvent"
        WHERE "status" = 'DEAD_LETTER'
          AND "createdAt" < $2
          ${whereOrg}
      `,
      sentBefore,
      deadBefore,
      organizationId ?? null,
    )

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        organizationId: organizationId ?? null,
        sentBefore: sentBefore.toISOString(),
        deadBefore: deadBefore.toISOString(),
        wouldDelete: {
          sent: Number(wouldSent[0]?.count || 0),
          deadLetter: Number(wouldDead[0]?.count || 0),
        },
      })
    }

    const deletedSent = await prisma.$executeRawUnsafe(
      `
        DELETE FROM "OutboxEvent"
        WHERE "status" = 'SENT'
          AND "createdAt" < $1
          ${whereOrg}
      `,
      sentBefore,
      deadBefore,
      organizationId ?? null,
    )

    const deletedDead = await prisma.$executeRawUnsafe(
      `
        DELETE FROM "OutboxEvent"
        WHERE "status" = 'DEAD_LETTER'
          AND "createdAt" < $2
          ${whereOrg}
      `,
      sentBefore,
      deadBefore,
      organizationId ?? null,
    )

    return NextResponse.json({
      ok: true,
      dryRun: false,
      organizationId: organizationId ?? null,
      sentBefore: sentBefore.toISOString(),
      deadBefore: deadBefore.toISOString(),
      deleted: { sent: Number(deletedSent || 0), deadLetter: Number(deletedDead || 0) },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ ok: false, error: message }, { status: message === "Unauthorized" ? 401 : 400 })
  }
}

