import { prisma } from "@/lib/prisma"

let ensurePromise: Promise<void> | null = null

async function run(sql: string) {
  await prisma.$executeRawUnsafe(sql)
}

async function ensureInventorySecuritySchemaInternal() {
  await run(`
    CREATE TABLE IF NOT EXISTS "InventoryMovementIdempotency" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "organizationId" TEXT NOT NULL,
      "idempotencyKey" TEXT NOT NULL,
      "requestHash" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "movementId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "InventoryMovementIdempotency_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "InventoryMovementIdempotency_movementId_fkey"
        FOREIGN KEY ("movementId") REFERENCES "InventoryMovement"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
    )
  `)

  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS "InventoryMovementIdempotency_org_key_unique"
      ON "InventoryMovementIdempotency"("organizationId", "idempotencyKey")
  `)
  await run(`
    CREATE INDEX IF NOT EXISTS "InventoryMovementIdempotency_status_idx"
      ON "InventoryMovementIdempotency"("status")
  `)
}

export async function ensureInventorySecuritySchema() {
  if (!ensurePromise) {
    ensurePromise = ensureInventorySecuritySchemaInternal().catch((error) => {
      ensurePromise = null
      throw error
    })
  }
  await ensurePromise
}
