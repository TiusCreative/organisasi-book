import { prisma } from "@/lib/prisma"

let ensurePromise: Promise<void> | null = null

async function run(sql: string) {
  await prisma.$executeRawUnsafe(sql)
}

async function ensureInventoryAccountingSchemaInternal() {
  await run(`
    CREATE TABLE IF NOT EXISTS "InventoryAccountingConfig" (
      "organizationId" TEXT PRIMARY KEY,
      "inventoryAccountId" TEXT,
      "wipAccountId" TEXT,
      "finishedGoodsAccountId" TEXT,
      "inventoryVarianceAccountId" TEXT,
      "cogsAccountId" TEXT,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "InventoryAccountingConfig_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "InventoryAccountingConfig_inventoryAccountId_fkey"
        FOREIGN KEY ("inventoryAccountId") REFERENCES "ChartOfAccount"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "InventoryAccountingConfig_wipAccountId_fkey"
        FOREIGN KEY ("wipAccountId") REFERENCES "ChartOfAccount"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "InventoryAccountingConfig_finishedGoodsAccountId_fkey"
        FOREIGN KEY ("finishedGoodsAccountId") REFERENCES "ChartOfAccount"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "InventoryAccountingConfig_inventoryVarianceAccountId_fkey"
        FOREIGN KEY ("inventoryVarianceAccountId") REFERENCES "ChartOfAccount"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "InventoryAccountingConfig_cogsAccountId_fkey"
        FOREIGN KEY ("cogsAccountId") REFERENCES "ChartOfAccount"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
    )
  `)
}

export async function ensureInventoryAccountingSchema() {
  if (!ensurePromise) {
    ensurePromise = ensureInventoryAccountingSchemaInternal().catch((error) => {
      ensurePromise = null
      throw error
    })
  }
  await ensurePromise
}

