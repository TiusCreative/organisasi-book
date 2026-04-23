import { prisma } from "@/lib/prisma"

let ensurePromise: Promise<void> | null = null

async function run(sql: string) {
  await prisma.$executeRawUnsafe(sql)
}

async function ensureWarehouseEnterpriseSchemaInternal() {
  await run(`
    CREATE TABLE IF NOT EXISTS "LotBatch" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "organizationId" TEXT NOT NULL,
      "itemId" TEXT NOT NULL,
      "code" TEXT NOT NULL,
      "expiryDate" DATE,
      "receivedAt" TIMESTAMP(3),
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "LotBatch_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "LotBatch_itemId_fkey"
        FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `)
  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS "LotBatch_org_item_code_unique"
      ON "LotBatch"("organizationId", "itemId", "code")
  `)
  await run(`
    CREATE INDEX IF NOT EXISTS "LotBatch_org_expiry_idx"
      ON "LotBatch"("organizationId", "expiryDate")
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS "PickWave" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "organizationId" TEXT NOT NULL,
      "warehouseId" TEXT NOT NULL,
      "code" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'OPEN',
      "notes" TEXT,
      "createdBy" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PickWave_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "PickWave_warehouseId_fkey"
        FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "PickWave_createdBy_fkey"
        FOREIGN KEY ("createdBy") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
    )
  `)
  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS "PickWave_org_code_unique"
      ON "PickWave"("organizationId", "code")
  `)
  await run(`
    CREATE INDEX IF NOT EXISTS "PickWave_org_wh_idx"
      ON "PickWave"("organizationId", "warehouseId")
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS "PickTask" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "organizationId" TEXT NOT NULL,
      "warehouseId" TEXT NOT NULL,
      "waveId" TEXT,
      "orderReference" TEXT,
      "itemId" TEXT NOT NULL,
      "quantity" DOUBLE PRECISION NOT NULL,
      "fromBinId" TEXT,
      "lotBatchId" TEXT,
      "status" TEXT NOT NULL DEFAULT 'OPEN',
      "assignedTo" TEXT,
      "createdBy" TEXT,
      "startedAt" TIMESTAMP(3),
      "doneAt" TIMESTAMP(3),
      "movementId" TEXT,
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PickTask_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "PickTask_warehouseId_fkey"
        FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "PickTask_waveId_fkey"
        FOREIGN KEY ("waveId") REFERENCES "PickWave"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "PickTask_itemId_fkey"
        FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "PickTask_fromBinId_fkey"
        FOREIGN KEY ("fromBinId") REFERENCES "WarehouseBin"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "PickTask_lotBatchId_fkey"
        FOREIGN KEY ("lotBatchId") REFERENCES "LotBatch"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "PickTask_assignedTo_fkey"
        FOREIGN KEY ("assignedTo") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "PickTask_createdBy_fkey"
        FOREIGN KEY ("createdBy") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "PickTask_movementId_fkey"
        FOREIGN KEY ("movementId") REFERENCES "InventoryMovement"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
    )
  `)
  await run(`
    CREATE INDEX IF NOT EXISTS "PickTask_org_status_idx"
      ON "PickTask"("organizationId", "status")
  `)
  await run(`
    CREATE INDEX IF NOT EXISTS "PickTask_wave_idx"
      ON "PickTask"("waveId")
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS "PutawayTask" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "organizationId" TEXT NOT NULL,
      "warehouseId" TEXT NOT NULL,
      "inboundReference" TEXT,
      "itemId" TEXT NOT NULL,
      "quantity" DOUBLE PRECISION NOT NULL,
      "stagingBinId" TEXT,
      "targetBinId" TEXT,
      "status" TEXT NOT NULL DEFAULT 'OPEN',
      "assignedTo" TEXT,
      "createdBy" TEXT,
      "startedAt" TIMESTAMP(3),
      "doneAt" TIMESTAMP(3),
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PutawayTask_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "PutawayTask_warehouseId_fkey"
        FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "PutawayTask_itemId_fkey"
        FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "PutawayTask_stagingBinId_fkey"
        FOREIGN KEY ("stagingBinId") REFERENCES "WarehouseBin"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "PutawayTask_targetBinId_fkey"
        FOREIGN KEY ("targetBinId") REFERENCES "WarehouseBin"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "PutawayTask_assignedTo_fkey"
        FOREIGN KEY ("assignedTo") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "PutawayTask_createdBy_fkey"
        FOREIGN KEY ("createdBy") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
    )
  `)
  await run(`
    CREATE INDEX IF NOT EXISTS "PutawayTask_org_status_idx"
      ON "PutawayTask"("organizationId", "status")
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS "InventoryMovementEvidence" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "organizationId" TEXT NOT NULL,
      "movementId" TEXT NOT NULL,
      "taskType" TEXT,
      "taskId" TEXT,
      "waveId" TEXT,
      "fromBinId" TEXT,
      "toBinId" TEXT,
      "lotBatchId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "InventoryMovementEvidence_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "InventoryMovementEvidence_movementId_fkey"
        FOREIGN KEY ("movementId") REFERENCES "InventoryMovement"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "InventoryMovementEvidence_fromBinId_fkey"
        FOREIGN KEY ("fromBinId") REFERENCES "WarehouseBin"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "InventoryMovementEvidence_toBinId_fkey"
        FOREIGN KEY ("toBinId") REFERENCES "WarehouseBin"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "InventoryMovementEvidence_lotBatchId_fkey"
        FOREIGN KEY ("lotBatchId") REFERENCES "LotBatch"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "InventoryMovementEvidence_waveId_fkey"
        FOREIGN KEY ("waveId") REFERENCES "PickWave"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
    )
  `)
  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS "InventoryMovementEvidence_org_movement_unique"
      ON "InventoryMovementEvidence"("organizationId", "movementId")
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS "WarehouseScanEvent" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "organizationId" TEXT NOT NULL,
      "eventType" TEXT NOT NULL,
      "barcode" TEXT NOT NULL,
      "itemId" TEXT,
      "binId" TEXT,
      "taskType" TEXT,
      "taskId" TEXT,
      "movementId" TEXT,
      "scannedBy" TEXT,
      "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "WarehouseScanEvent_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "WarehouseScanEvent_itemId_fkey"
        FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "WarehouseScanEvent_binId_fkey"
        FOREIGN KEY ("binId") REFERENCES "WarehouseBin"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "WarehouseScanEvent_movementId_fkey"
        FOREIGN KEY ("movementId") REFERENCES "InventoryMovement"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "WarehouseScanEvent_scannedBy_fkey"
        FOREIGN KEY ("scannedBy") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
    )
  `)
  await run(`
    CREATE INDEX IF NOT EXISTS "WarehouseScanEvent_org_scanned_idx"
      ON "WarehouseScanEvent"("organizationId", "scannedAt")
  `)
  await run(`
    CREATE INDEX IF NOT EXISTS "WarehouseScanEvent_task_idx"
      ON "WarehouseScanEvent"("taskType", "taskId")
  `)
  await run(`
    CREATE INDEX IF NOT EXISTS "WarehouseScanEvent_movement_idx"
      ON "WarehouseScanEvent"("movementId")
  `)
}

export async function ensureWarehouseEnterpriseSchema() {
  if (!ensurePromise) {
    ensurePromise = ensureWarehouseEnterpriseSchemaInternal().catch((error) => {
      ensurePromise = null
      throw error
    })
  }
  await ensurePromise
}

