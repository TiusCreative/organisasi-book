import { prisma } from "@/lib/prisma"

let ensurePromise: Promise<void> | null = null

async function run(sql: string) {
  await prisma.$executeRawUnsafe(sql)
}

async function ensureWarehouseLocationSchemaInternal() {
  await run(`
    CREATE TABLE IF NOT EXISTS "WarehouseZone" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "organizationId" TEXT NOT NULL,
      "warehouseId" TEXT NOT NULL,
      "code" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "WarehouseZone_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "WarehouseZone_warehouseId_fkey"
        FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `)

  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS "WarehouseZone_org_wh_code_unique"
      ON "WarehouseZone"("organizationId", "warehouseId", "code")
  `)
  await run(`
    CREATE INDEX IF NOT EXISTS "WarehouseZone_org_idx"
      ON "WarehouseZone"("organizationId")
  `)
  await run(`
    CREATE INDEX IF NOT EXISTS "WarehouseZone_warehouse_idx"
      ON "WarehouseZone"("warehouseId")
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS "WarehouseAisle" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "organizationId" TEXT NOT NULL,
      "warehouseId" TEXT NOT NULL,
      "zoneId" TEXT,
      "code" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "WarehouseAisle_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "WarehouseAisle_warehouseId_fkey"
        FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "WarehouseAisle_zoneId_fkey"
        FOREIGN KEY ("zoneId") REFERENCES "WarehouseZone"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
    )
  `)

  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS "WarehouseAisle_org_wh_code_unique"
      ON "WarehouseAisle"("organizationId", "warehouseId", "code")
  `)
  await run(`
    CREATE INDEX IF NOT EXISTS "WarehouseAisle_zone_idx"
      ON "WarehouseAisle"("zoneId")
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS "WarehouseRack" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "organizationId" TEXT NOT NULL,
      "warehouseId" TEXT NOT NULL,
      "aisleId" TEXT,
      "code" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "WarehouseRack_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "WarehouseRack_warehouseId_fkey"
        FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "WarehouseRack_aisleId_fkey"
        FOREIGN KEY ("aisleId") REFERENCES "WarehouseAisle"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
    )
  `)

  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS "WarehouseRack_org_wh_code_unique"
      ON "WarehouseRack"("organizationId", "warehouseId", "code")
  `)
  await run(`
    CREATE INDEX IF NOT EXISTS "WarehouseRack_aisle_idx"
      ON "WarehouseRack"("aisleId")
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS "WarehouseBin" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "organizationId" TEXT NOT NULL,
      "warehouseId" TEXT NOT NULL,
      "rackId" TEXT,
      "code" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "barcode" TEXT,
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "WarehouseBin_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "WarehouseBin_warehouseId_fkey"
        FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "WarehouseBin_rackId_fkey"
        FOREIGN KEY ("rackId") REFERENCES "WarehouseRack"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
    )
  `)

  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS "WarehouseBin_org_wh_code_unique"
      ON "WarehouseBin"("organizationId", "warehouseId", "code")
  `)
  await run(`
    CREATE INDEX IF NOT EXISTS "WarehouseBin_rack_idx"
      ON "WarehouseBin"("rackId")
  `)
  await run(`
    CREATE INDEX IF NOT EXISTS "WarehouseBin_warehouse_idx"
      ON "WarehouseBin"("warehouseId")
  `)
}

export async function ensureWarehouseLocationSchema() {
  if (!ensurePromise) {
    ensurePromise = ensureWarehouseLocationSchemaInternal().catch((error) => {
      ensurePromise = null
      throw error
    })
  }
  await ensurePromise
}

