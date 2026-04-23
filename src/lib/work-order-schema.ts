import { prisma } from "@/lib/prisma"

let ensurePromise: Promise<void> | null = null

async function run(sql: string) {
  await prisma.$executeRawUnsafe(sql)
}

async function ensureWorkOrderHppSchemaInternal() {
  // WorkOrderCostType enum
  await run(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkOrderCostType') THEN
        CREATE TYPE "WorkOrderCostType" AS ENUM ('LABOR', 'OVERHEAD', 'MACHINE', 'SUBCONTRACT', 'WASTE');
      END IF;
    END
    $$;
  `)

  // Extend legacy WorkOrder schema for HPP
  const workOrderColumns = [
    `"productItemId" TEXT`,
    `"bomId" TEXT`,
    `"plannedQty" DOUBLE PRECISION NOT NULL DEFAULT 0`,
    `"actualQty" DOUBLE PRECISION NOT NULL DEFAULT 0`,
    `"plannedMaterialCost" DOUBLE PRECISION NOT NULL DEFAULT 0`,
    `"plannedLaborCost" DOUBLE PRECISION NOT NULL DEFAULT 0`,
    `"plannedOverheadCost" DOUBLE PRECISION NOT NULL DEFAULT 0`,
    `"plannedMachineCost" DOUBLE PRECISION NOT NULL DEFAULT 0`,
    `"plannedSubcontractCost" DOUBLE PRECISION NOT NULL DEFAULT 0`,
    `"plannedWasteValue" DOUBLE PRECISION NOT NULL DEFAULT 0`,
    `"plannedTotalCost" DOUBLE PRECISION NOT NULL DEFAULT 0`,
    `"actualMaterialCost" DOUBLE PRECISION NOT NULL DEFAULT 0`,
    `"actualLaborCost" DOUBLE PRECISION NOT NULL DEFAULT 0`,
    `"actualOverheadCost" DOUBLE PRECISION NOT NULL DEFAULT 0`,
    `"actualMachineCost" DOUBLE PRECISION NOT NULL DEFAULT 0`,
    `"actualSubcontractCost" DOUBLE PRECISION NOT NULL DEFAULT 0`,
    `"actualWasteValue" DOUBLE PRECISION NOT NULL DEFAULT 0`,
    `"actualTotalCost" DOUBLE PRECISION NOT NULL DEFAULT 0`,
    `"hppPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0`,
    `"varianceAmount" DOUBLE PRECISION NOT NULL DEFAULT 0`,
    `"variancePercent" DOUBLE PRECISION NOT NULL DEFAULT 0`,
  ]

  for (const column of workOrderColumns) {
    await run(`ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS ${column}`)
  }

  await run(`ALTER TABLE "WorkOrder" ALTER COLUMN "status" SET DEFAULT 'DRAFT'`)

  // BOM master
  await run(`
    CREATE TABLE IF NOT EXISTS "BillOfMaterial" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "organizationId" TEXT NOT NULL,
      "productItemId" TEXT NOT NULL,
      "code" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "version" INTEGER NOT NULL DEFAULT 1,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "BillOfMaterial_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "BillOfMaterial_productItemId_fkey"
        FOREIGN KEY ("productItemId") REFERENCES "InventoryItem"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS "BillOfMaterialLine" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "bomId" TEXT NOT NULL,
      "componentItemId" TEXT NOT NULL,
      "quantityPerUnit" DOUBLE PRECISION NOT NULL,
      "uom" TEXT,
      "scrapPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "sequence" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "BillOfMaterialLine_bomId_fkey"
        FOREIGN KEY ("bomId") REFERENCES "BillOfMaterial"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "BillOfMaterialLine_componentItemId_fkey"
        FOREIGN KEY ("componentItemId") REFERENCES "InventoryItem"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `)

  // WO actual material issues
  await run(`
    CREATE TABLE IF NOT EXISTS "WorkOrderMaterialIssue" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "workOrderId" TEXT NOT NULL,
      "itemId" TEXT NOT NULL,
      "plannedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "issuedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "movementId" TEXT,
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "WorkOrderMaterialIssue_workOrderId_fkey"
        FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "WorkOrderMaterialIssue_itemId_fkey"
        FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "WorkOrderMaterialIssue_movementId_fkey"
        FOREIGN KEY ("movementId") REFERENCES "InventoryMovement"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
    )
  `)

  // WO non-material cost entries
  await run(`
    CREATE TABLE IF NOT EXISTS "WorkOrderCostEntry" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "workOrderId" TEXT NOT NULL,
      "costType" "WorkOrderCostType" NOT NULL,
      "amount" DOUBLE PRECISION NOT NULL,
      "reference" TEXT,
      "description" TEXT,
      "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "WorkOrderCostEntry_workOrderId_fkey"
        FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `)

  // WO chain links for semi-finished production flow
  await run(`
    CREATE TABLE IF NOT EXISTS "WorkOrderChainLink" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "organizationId" TEXT NOT NULL,
      "parentWorkOrderId" TEXT NOT NULL,
      "childWorkOrderId" TEXT NOT NULL,
      "componentItemId" TEXT NOT NULL,
      "requiredQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "generationLevel" INTEGER NOT NULL DEFAULT 1,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "WorkOrderChainLink_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "WorkOrderChainLink_parentWorkOrderId_fkey"
        FOREIGN KEY ("parentWorkOrderId") REFERENCES "WorkOrder"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "WorkOrderChainLink_childWorkOrderId_fkey"
        FOREIGN KEY ("childWorkOrderId") REFERENCES "WorkOrder"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "WorkOrderChainLink_componentItemId_fkey"
        FOREIGN KEY ("componentItemId") REFERENCES "InventoryItem"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `)

  // Missing relations/constraints/indexes for compatibility
  await run(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'WorkOrder_productItemId_fkey'
      ) THEN
        ALTER TABLE "WorkOrder"
          ADD CONSTRAINT "WorkOrder_productItemId_fkey"
          FOREIGN KEY ("productItemId") REFERENCES "InventoryItem"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END
    $$;
  `)

  await run(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'WorkOrder_bomId_fkey'
      ) THEN
        ALTER TABLE "WorkOrder"
          ADD CONSTRAINT "WorkOrder_bomId_fkey"
          FOREIGN KEY ("bomId") REFERENCES "BillOfMaterial"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END
    $$;
  `)

  await run(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'WorkOrderItem_itemId_fkey'
      ) THEN
        ALTER TABLE "WorkOrderItem"
          ADD CONSTRAINT "WorkOrderItem_itemId_fkey"
          FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END
    $$;
  `)

  const indexes = [
    `CREATE UNIQUE INDEX IF NOT EXISTS "BillOfMaterial_organizationId_code_version_key" ON "BillOfMaterial"("organizationId", "code", "version")`,
    `CREATE INDEX IF NOT EXISTS "BillOfMaterial_organizationId_idx" ON "BillOfMaterial"("organizationId")`,
    `CREATE INDEX IF NOT EXISTS "BillOfMaterial_productItemId_idx" ON "BillOfMaterial"("productItemId")`,
    `CREATE INDEX IF NOT EXISTS "BillOfMaterial_isActive_idx" ON "BillOfMaterial"("isActive")`,
    `CREATE INDEX IF NOT EXISTS "BillOfMaterialLine_bomId_idx" ON "BillOfMaterialLine"("bomId")`,
    `CREATE INDEX IF NOT EXISTS "BillOfMaterialLine_componentItemId_idx" ON "BillOfMaterialLine"("componentItemId")`,
    `CREATE INDEX IF NOT EXISTS "BillOfMaterialLine_sequence_idx" ON "BillOfMaterialLine"("sequence")`,
    `CREATE INDEX IF NOT EXISTS "WorkOrder_productItemId_idx" ON "WorkOrder"("productItemId")`,
    `CREATE INDEX IF NOT EXISTS "WorkOrder_bomId_idx" ON "WorkOrder"("bomId")`,
    `CREATE INDEX IF NOT EXISTS "WorkOrderMaterialIssue_workOrderId_idx" ON "WorkOrderMaterialIssue"("workOrderId")`,
    `CREATE INDEX IF NOT EXISTS "WorkOrderMaterialIssue_itemId_idx" ON "WorkOrderMaterialIssue"("itemId")`,
    `CREATE INDEX IF NOT EXISTS "WorkOrderMaterialIssue_movementId_idx" ON "WorkOrderMaterialIssue"("movementId")`,
    `CREATE INDEX IF NOT EXISTS "WorkOrderCostEntry_workOrderId_idx" ON "WorkOrderCostEntry"("workOrderId")`,
    `CREATE INDEX IF NOT EXISTS "WorkOrderCostEntry_costType_idx" ON "WorkOrderCostEntry"("costType")`,
    `CREATE INDEX IF NOT EXISTS "WorkOrderCostEntry_entryDate_idx" ON "WorkOrderCostEntry"("entryDate")`,
    `CREATE INDEX IF NOT EXISTS "WorkOrderChainLink_organizationId_idx" ON "WorkOrderChainLink"("organizationId")`,
    `CREATE INDEX IF NOT EXISTS "WorkOrderChainLink_parentWorkOrderId_idx" ON "WorkOrderChainLink"("parentWorkOrderId")`,
    `CREATE INDEX IF NOT EXISTS "WorkOrderChainLink_childWorkOrderId_idx" ON "WorkOrderChainLink"("childWorkOrderId")`,
    `CREATE INDEX IF NOT EXISTS "WorkOrderChainLink_componentItemId_idx" ON "WorkOrderChainLink"("componentItemId")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "WorkOrderChainLink_parent_child_component_key" ON "WorkOrderChainLink"("parentWorkOrderId", "childWorkOrderId", "componentItemId")`,
  ]

  for (const indexSql of indexes) {
    await run(indexSql)
  }
}

export async function ensureWorkOrderHppSchema() {
  if (!ensurePromise) {
    ensurePromise = ensureWorkOrderHppSchemaInternal().catch((error) => {
      ensurePromise = null
      throw error
    })
  }

  await ensurePromise
}
