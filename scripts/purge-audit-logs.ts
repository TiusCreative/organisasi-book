import { prisma } from "../src/lib/prisma"

function normalizeText(value?: string) {
  const trimmed = (value ?? "").trim()
  return trimmed.length ? trimmed : undefined
}

function parseNumber(value: unknown, fallback: number) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

async function run() {
  const organizationId = normalizeText(process.env.OPS_ORG_ID)
  const allowAllOrganizations = String(process.env.ALLOW_ALL_ORGS ?? "").toLowerCase() === "true"
  const dryRun = String(process.env.DRY_RUN ?? "true").toLowerCase() !== "false"
  const days = Math.max(7, Math.min(3650, parseNumber(process.env.AUDIT_RETENTION_DAYS, 365)))

  if (!organizationId && !allowAllOrganizations) {
    throw new Error("Untuk purge global, set ALLOW_ALL_ORGS=true atau isi OPS_ORG_ID")
  }

  const before = daysAgo(days)
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
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          organizationId: organizationId ?? null,
          before: before.toISOString(),
          wouldDelete: {
            total,
            byAction: counts.map((c) => ({ action: c.action, count: c._count._all })),
          },
        },
        null,
        2,
      ),
    )
    return
  }

  const deleted = await prisma.auditLog.deleteMany({ where })
  console.log(
    JSON.stringify(
      {
        dryRun: false,
        organizationId: organizationId ?? null,
        before: before.toISOString(),
        deleted: deleted.count,
      },
      null,
      2,
    ),
  )
}

run()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

