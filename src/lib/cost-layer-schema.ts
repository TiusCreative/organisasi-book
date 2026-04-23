import { prisma } from "@/lib/prisma"

let ensurePromise: Promise<void> | null = null

async function run(sql: string) {
  await prisma.$executeRawUnsafe(sql)
}

async function ensureCostLayerSchemaInternal() {
  await run(`
    CREATE TABLE IF NOT EXISTS "CostLayer" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "organizationId" TEXT NOT NULL,
      "itemId" TEXT NOT NULL,
      "movementInId" TEXT,
      "receivedQty" DOUBLE PRECISION NOT NULL,
      "remainingQty" DOUBLE PRECISION NOT NULL,
      "unitCost" DOUBLE PRECISION NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CostLayer_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "CostLayer_itemId_fkey"
        FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "CostLayer_movementInId_fkey"
        FOREIGN KEY ("movementInId") REFERENCES "InventoryMovement"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
    )
  `)

  await run(`
    CREATE INDEX IF NOT EXISTS "CostLayer_org_item_idx"
      ON "CostLayer"("organizationId", "itemId")
  `)

  await run(`
    CREATE INDEX IF NOT EXISTS "CostLayer_createdAt_idx"
      ON "CostLayer"("createdAt")
  `)

  await run(`
    CREATE INDEX IF NOT EXISTS "CostLayer_remaining_idx"
      ON "CostLayer"("remainingQty")
  `)
}

export async function ensureCostLayerSchema() {
  if (!ensurePromise) {
    ensurePromise = ensureCostLayerSchemaInternal().catch((error) => {
      ensurePromise = null
      throw error
    })
  }
  await ensurePromise
}

