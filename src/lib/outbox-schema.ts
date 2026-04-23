import { prisma } from "@/lib/prisma"

let ensurePromise: Promise<void> | null = null

async function run(sql: string) {
  await prisma.$executeRawUnsafe(sql)
}

async function ensureOutboxSchemaInternal() {
  await run(`
    CREATE TABLE IF NOT EXISTS "OutboxEvent" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "organizationId" TEXT NOT NULL,
      "aggregateType" TEXT NOT NULL,
      "aggregateId" TEXT NOT NULL,
      "eventType" TEXT NOT NULL,
      "schemaVersion" INTEGER NOT NULL DEFAULT 1,
      "payloadJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "dedupeKey" TEXT,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "attempts" INTEGER NOT NULL DEFAULT 0,
      "nextRetryAt" TIMESTAMP(3),
      "lockedAt" TIMESTAMP(3),
      "lockedBy" TEXT,
      "sentAt" TIMESTAMP(3),
      "lastError" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "OutboxEvent_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `)

  await run(`
    CREATE INDEX IF NOT EXISTS "OutboxEvent_org_status_idx"
      ON "OutboxEvent"("organizationId", "status")
  `)
  await run(`
    CREATE INDEX IF NOT EXISTS "OutboxEvent_status_retry_idx"
      ON "OutboxEvent"("status", "nextRetryAt")
  `)
  await run(`
    CREATE INDEX IF NOT EXISTS "OutboxEvent_org_created_idx"
      ON "OutboxEvent"("organizationId", "createdAt")
  `)
  await run(`
    CREATE INDEX IF NOT EXISTS "OutboxEvent_locked_idx"
      ON "OutboxEvent"("status", "lockedAt")
  `)
  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS "OutboxEvent_org_dedupe_unique"
      ON "OutboxEvent"("organizationId", "dedupeKey")
  `)
}

export async function ensureOutboxSchema() {
  if (!ensurePromise) {
    ensurePromise = ensureOutboxSchemaInternal().catch((error) => {
      ensurePromise = null
      throw error
    })
  }
  await ensurePromise
}
