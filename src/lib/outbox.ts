import { prisma } from "@/lib/prisma"
import { ensureOutboxSchema } from "@/lib/outbox-schema"
import { applyOutboxEventToReadModels, ensureWarehouseReadModelSchema } from "@/lib/warehouse-read-model"

export type OutboxStatus = "PENDING" | "SENDING" | "SENT" | "DEAD_LETTER"

export type EnqueueOutboxEventInput = {
  organizationId: string
  aggregateType: string
  aggregateId: string
  eventType: string
  schemaVersion?: number
  payload: unknown
  dedupeKey?: string
}

export async function enqueueOutboxEventInTx(
  tx: { $executeRawUnsafe: (sql: string, ...values: unknown[]) => Promise<number> },
  input: EnqueueOutboxEventInput,
) {
  const schemaVersion = input.schemaVersion ?? 1
  const payloadJson = JSON.stringify(input.payload ?? {})

  await tx.$executeRawUnsafe(
    `
      INSERT INTO "OutboxEvent"
        ("organizationId", "aggregateType", "aggregateId", "eventType", "schemaVersion", "payloadJson", "dedupeKey", "status")
      VALUES
        ($1, $2, $3, $4, $5, $6::jsonb, $7, 'PENDING')
      ON CONFLICT ("organizationId", "dedupeKey") DO NOTHING
    `,
    input.organizationId,
    input.aggregateType,
    input.aggregateId,
    input.eventType,
    schemaVersion,
    payloadJson,
    input.dedupeKey ?? null,
  )
}

type OutboxRow = {
  id: string
  organizationId: string
  aggregateType: string
  aggregateId: string
  eventType: string
  schemaVersion: number
  payloadJson: unknown
  dedupeKey: string | null
  status: OutboxStatus
  attempts: number
  nextRetryAt: Date | null
  lockedAt: Date | null
  lockedBy: string | null
  sentAt: Date | null
  lastError: string | null
  createdAt: Date
  updatedAt: Date
}

function computeNextRetry(attempts: number) {
  const baseMs = 2_000
  const maxMs = 5 * 60_000
  const delay = Math.min(maxMs, baseMs * Math.pow(2, Math.max(0, attempts)))
  return new Date(Date.now() + delay)
}

async function claimPendingEventsInTx(
  tx: { $queryRawUnsafe: <T>(sql: string, ...values: unknown[]) => Promise<T> },
  batchSize: number,
  publisherId: string,
) {
  await ensureOutboxSchema()
  const rows = await tx.$queryRawUnsafe<OutboxRow[]>(
    `
      WITH picked AS (
        SELECT "id"
        FROM "OutboxEvent"
        WHERE "status" = 'PENDING'
          AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= CURRENT_TIMESTAMP)
        ORDER BY "createdAt" ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "OutboxEvent" e
      SET "status" = 'SENDING',
          "lockedAt" = CURRENT_TIMESTAMP,
          "lockedBy" = $2,
          "updatedAt" = CURRENT_TIMESTAMP
      FROM picked
      WHERE e."id" = picked."id"
      RETURNING e.*
    `,
    batchSize,
    publisherId,
  )
  return rows
}

async function markSent(eventId: string) {
  await prisma.$executeRawUnsafe(
    `
      UPDATE "OutboxEvent"
      SET "status" = 'SENT',
          "sentAt" = CURRENT_TIMESTAMP,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = $1
    `,
    eventId,
  )
}

async function markFailed(eventId: string, attempts: number, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const nextRetryAt = computeNextRetry(attempts)

  const deadLetter = attempts >= 12
  await prisma.$executeRawUnsafe(
    `
      UPDATE "OutboxEvent"
      SET "status" = $2,
          "attempts" = $3,
          "nextRetryAt" = $4,
          "lastError" = $5,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = $1
    `,
    eventId,
    deadLetter ? "DEAD_LETTER" : "PENDING",
    attempts,
    deadLetter ? null : nextRetryAt,
    message,
  )
}

export type PublishOutboxResult = {
  claimed: number
  sent: number
  failed: number
  deadLettered: number
}

export async function publishPendingOutboxEvents(input?: { batchSize?: number; publisherId?: string }) {
  await ensureOutboxSchema()
  await ensureWarehouseReadModelSchema()

  const batchSize = Math.max(1, Math.min(200, Number(input?.batchSize ?? 50)))
  const publisherId = (input?.publisherId ?? `local:${process.pid}`).slice(0, 120)

  const claimed = await prisma.$transaction(async (tx) => claimPendingEventsInTx(tx, batchSize, publisherId))
  let sent = 0
  let failed = 0
  let deadLettered = 0

  for (const event of claimed) {
    try {
      await applyOutboxEventToReadModels(event)
      await markSent(event.id)
      sent += 1
    } catch (error) {
      const nextAttempts = Number(event.attempts || 0) + 1
      await markFailed(event.id, nextAttempts, error)
      failed += 1
      if (nextAttempts >= 12) deadLettered += 1
    }
  }

  return { claimed: claimed.length, sent, failed, deadLettered } satisfies PublishOutboxResult
}

export async function getOutboxMetrics() {
  await ensureOutboxSchema()
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      status: string
      count: number
      oldestCreatedAt: Date | null
    }>
  >(
    `
      SELECT
        "status" as status,
        COUNT(*)::int as count,
        MIN("createdAt") as "oldestCreatedAt"
      FROM "OutboxEvent"
      GROUP BY "status"
    `,
  )

  const counts: Record<string, number> = {}
  let oldestPending: Date | null = null
  for (const row of rows) {
    counts[row.status] = Number(row.count || 0)
    if (row.status === "PENDING") oldestPending = row.oldestCreatedAt
  }

  const pending = counts.PENDING ?? 0
  const sending = counts.SENDING ?? 0
  const sent = counts.SENT ?? 0
  const dead = counts.DEAD_LETTER ?? 0

  return {
    pending,
    sending,
    sent,
    deadLetter: dead,
    oldestPendingAt: oldestPending ? oldestPending.toISOString() : null,
  }
}
