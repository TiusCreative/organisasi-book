import { prisma } from "@/lib/prisma"

let ensurePromise: Promise<void> | null = null

async function run(sql: string) {
  await prisma.$executeRawUnsafe(sql)
}

async function ensureStockBalanceSchemaInternal() {
  await run(`
    CREATE TABLE IF NOT EXISTS "StockBalance" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "organizationId" TEXT NOT NULL,
      "itemId" TEXT NOT NULL,
      "warehouseId" TEXT NOT NULL,
      "binId" TEXT,
      "lotBatchId" TEXT,
      "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "StockBalance_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "StockBalance_itemId_fkey"
        FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "StockBalance_warehouseId_fkey"
        FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "StockBalance_binId_fkey"
        FOREIGN KEY ("binId") REFERENCES "WarehouseBin"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "StockBalance_lotBatchId_fkey"
        FOREIGN KEY ("lotBatchId") REFERENCES "LotBatch"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
    )
  `)

  await run(`DROP INDEX IF EXISTS "StockBalance_org_item_bin_lot_unique"`)
  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS "StockBalance_org_item_bin_lot_unique_v2"
      ON "StockBalance"("organizationId", "itemId", COALESCE("binId", '__NULL__'), COALESCE("lotBatchId", '__NULL__'))
  `)
  await run(`
    CREATE INDEX IF NOT EXISTS "StockBalance_org_wh_idx"
      ON "StockBalance"("organizationId", "warehouseId")
  `)
  await run(`
    CREATE INDEX IF NOT EXISTS "StockBalance_org_item_idx"
      ON "StockBalance"("organizationId", "itemId")
  `)
}

export async function ensureStockBalanceSchema() {
  if (!ensurePromise) {
    ensurePromise = ensureStockBalanceSchemaInternal().catch((error) => {
      ensurePromise = null
      throw error
    })
  }
  await ensurePromise
}
