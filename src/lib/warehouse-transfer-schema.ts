import { prisma } from "@/lib/prisma"

let ensurePromise: Promise<void> | null = null

async function run(sql: string) {
  await prisma.$executeRawUnsafe(sql)
}

async function ensureWarehouseTransferSchemaInternal() {
  await run(`
    CREATE TABLE IF NOT EXISTS "TransferOrder" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "organizationId" TEXT NOT NULL,
      "code" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'POSTED',
      "fromWarehouseId" TEXT NOT NULL,
      "toWarehouseId" TEXT NOT NULL,
      "notes" TEXT,
      "createdBy" TEXT,
      "approvedBy" TEXT,
      "approvedAt" TIMESTAMP(3),
      "movementOutId" TEXT,
      "movementInId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TransferOrder_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "TransferOrder_fromWarehouseId_fkey"
        FOREIGN KEY ("fromWarehouseId") REFERENCES "Warehouse"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "TransferOrder_toWarehouseId_fkey"
        FOREIGN KEY ("toWarehouseId") REFERENCES "Warehouse"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "TransferOrder_createdBy_fkey"
        FOREIGN KEY ("createdBy") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "TransferOrder_approvedBy_fkey"
        FOREIGN KEY ("approvedBy") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "TransferOrder_movementOutId_fkey"
        FOREIGN KEY ("movementOutId") REFERENCES "InventoryMovement"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "TransferOrder_movementInId_fkey"
        FOREIGN KEY ("movementInId") REFERENCES "InventoryMovement"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
    )
  `)

  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS "TransferOrder_org_code_unique"
      ON "TransferOrder"("organizationId", "code")
  `)
  await run(`
    CREATE INDEX IF NOT EXISTS "TransferOrder_org_idx"
      ON "TransferOrder"("organizationId")
  `)
  await run(`
    CREATE INDEX IF NOT EXISTS "TransferOrder_fromWarehouse_idx"
      ON "TransferOrder"("fromWarehouseId")
  `)
  await run(`
    CREATE INDEX IF NOT EXISTS "TransferOrder_toWarehouse_idx"
      ON "TransferOrder"("toWarehouseId")
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS "TransferOrderLine" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "transferOrderId" TEXT NOT NULL,
      "fromItemId" TEXT NOT NULL,
      "toItemId" TEXT NOT NULL,
      "quantity" DOUBLE PRECISION NOT NULL,
      "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TransferOrderLine_transferOrderId_fkey"
        FOREIGN KEY ("transferOrderId") REFERENCES "TransferOrder"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "TransferOrderLine_fromItemId_fkey"
        FOREIGN KEY ("fromItemId") REFERENCES "InventoryItem"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "TransferOrderLine_toItemId_fkey"
        FOREIGN KEY ("toItemId") REFERENCES "InventoryItem"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `)

  await run(`
    CREATE INDEX IF NOT EXISTS "TransferOrderLine_transferOrder_idx"
      ON "TransferOrderLine"("transferOrderId")
  `)
}

export async function ensureWarehouseTransferSchema() {
  if (!ensurePromise) {
    ensurePromise = ensureWarehouseTransferSchemaInternal().catch((error) => {
      ensurePromise = null
      throw error
    })
  }
  await ensurePromise
}

