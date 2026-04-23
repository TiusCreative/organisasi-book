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

async function purgeOutbox(input: {
  organizationId?: string
  dryRun: boolean
  sentDays: number
  deadDays: number
}) {
  const sentBefore = daysAgo(input.sentDays)
  const deadBefore = daysAgo(input.deadDays)

  const whereOrg = input.organizationId ? `AND "organizationId" = $3` : ""

  const sentCount = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    `
      SELECT COUNT(*)::int as count
      FROM "OutboxEvent"
      WHERE "status" = 'SENT'
        AND "createdAt" < $1
        ${whereOrg}
    `,
    sentBefore,
    deadBefore,
    input.organizationId ?? null,
  )

  const deadCount = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    `
      SELECT COUNT(*)::int as count
      FROM "OutboxEvent"
      WHERE "status" = 'DEAD_LETTER'
        AND "createdAt" < $2
        ${whereOrg}
    `,
    sentBefore,
    deadBefore,
    input.organizationId ?? null,
  )

  if (input.dryRun) {
    return {
      dryRun: true,
      sentBefore: sentBefore.toISOString(),
      deadBefore: deadBefore.toISOString(),
      wouldDelete: {
        sent: Number(sentCount[0]?.count || 0),
        deadLetter: Number(deadCount[0]?.count || 0),
      },
    }
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
    input.organizationId ?? null,
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
    input.organizationId ?? null,
  )

  return {
    dryRun: false,
    sentBefore: sentBefore.toISOString(),
    deadBefore: deadBefore.toISOString(),
    deleted: { sent: Number(deletedSent || 0), deadLetter: Number(deletedDead || 0) },
  }
}

async function run() {
  const organizationId = normalizeText(process.env.OPS_ORG_ID)
  const dryRun = String(process.env.DRY_RUN ?? "true").toLowerCase() !== "false"
  const sentDays = Math.max(1, parseNumber(process.env.OUTBOX_SENT_DAYS, 30))
  const deadDays = Math.max(1, parseNumber(process.env.OUTBOX_DEAD_DAYS, 180))

  const result = await purgeOutbox({ organizationId, dryRun, sentDays, deadDays })
  console.log(JSON.stringify(result, null, 2))
}

run()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

