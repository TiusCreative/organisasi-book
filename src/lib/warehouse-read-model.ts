import { prisma } from "@/lib/prisma"

export type OutboxEventRow = {
  id: string
  organizationId: string
  aggregateType: string
  aggregateId: string
  eventType: string
  schemaVersion: number
  payloadJson: unknown
  createdAt: Date
}

let ensurePromise: Promise<void> | null = null

async function run(sql: string) {
  await prisma.$executeRawUnsafe(sql)
}

async function ensureWarehouseReadModelSchemaInternal() {
  await run(`
    CREATE TABLE IF NOT EXISTS "rm_movement_fact" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "organizationId" TEXT NOT NULL,
      "movementId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL,
      "movementType" TEXT NOT NULL,
      "itemId" TEXT NOT NULL,
      "itemCode" TEXT NOT NULL,
      "itemName" TEXT NOT NULL,
      "warehouseId" TEXT,
      "warehouseCode" TEXT,
      "quantity" DOUBLE PRECISION NOT NULL,
      "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "reference" TEXT,
      "description" TEXT,
      "performedBy" TEXT,
      "fromWarehouseId" TEXT,
      "toWarehouseId" TEXT,
      "createdAtRow" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS "rm_movement_fact_org_movement_unique"
      ON "rm_movement_fact"("organizationId", "movementId")
  `)
  await run(`
    CREATE INDEX IF NOT EXISTS "rm_movement_fact_org_created_idx"
      ON "rm_movement_fact"("organizationId", "createdAt")
  `)
  await run(`
    CREATE INDEX IF NOT EXISTS "rm_movement_fact_org_item_idx"
      ON "rm_movement_fact"("organizationId", "itemId")
  `)
  await run(`
    CREATE INDEX IF NOT EXISTS "rm_movement_fact_org_wh_idx"
      ON "rm_movement_fact"("organizationId", "warehouseId")
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS "rm_stock_value_daily" (
      "organizationId" TEXT NOT NULL,
      "warehouseId" TEXT,
      "day" DATE NOT NULL,
      "movementCount" INTEGER NOT NULL DEFAULT 0,
      "totalInCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "totalOutCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "totalAdjustmentCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY ("organizationId", "warehouseId", "day")
    )
  `)

  await run(`
    CREATE INDEX IF NOT EXISTS "rm_stock_value_daily_org_day_idx"
      ON "rm_stock_value_daily"("organizationId", "day")
  `)
}

export async function ensureWarehouseReadModelSchema() {
  if (!ensurePromise) {
    ensurePromise = ensureWarehouseReadModelSchemaInternal().catch((error) => {
      ensurePromise = null
      throw error
    })
  }
  await ensurePromise
}

function pickDailyTotals(movementType: string, totalCost: number) {
  if (movementType === "IN") {
    return { totalInCost: totalCost, totalOutCost: 0, totalAdjustmentCost: 0 }
  }
  if (movementType === "OUT" || movementType === "TRANSFER") {
    return { totalInCost: 0, totalOutCost: totalCost, totalAdjustmentCost: 0 }
  }
  if (movementType === "ADJUSTMENT") {
    return { totalInCost: 0, totalOutCost: 0, totalAdjustmentCost: totalCost }
  }
  return { totalInCost: 0, totalOutCost: 0, totalAdjustmentCost: 0 }
}

export async function applyOutboxEventToReadModels(event: OutboxEventRow) {
  await ensureWarehouseReadModelSchema()

  if (event.eventType !== "inventory.movement.posted") {
    return
  }

  const payload = (event.payloadJson ?? {}) as { movementId?: string }
  const movementId = String(payload.movementId || event.aggregateId || "")
  if (!movementId) return

  const movement = await prisma.inventoryMovement.findFirst({
    where: { id: movementId, organizationId: event.organizationId },
    include: {
      item: {
        select: {
          id: true,
          code: true,
          name: true,
          warehouseId: true,
          warehouse: { select: { code: true } },
        },
      },
    },
  })

  if (!movement || !movement.item) return

  const createdAt = movement.createdAt
  const movementType = String(movement.movementType || "")
  const quantity = Number(movement.quantity || 0)
  const unitCost = Number(movement.unitCost || 0)
  const totalCost = Number(movement.totalCost || 0)
  const day = createdAt.toISOString().slice(0, 10)

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "rm_movement_fact"
        ("organizationId", "movementId", "createdAt", "movementType",
         "itemId", "itemCode", "itemName", "warehouseId", "warehouseCode",
         "quantity", "unitCost", "totalCost", "reference", "description", "performedBy", "fromWarehouseId", "toWarehouseId")
      VALUES
        ($1, $2, $3, $4,
         $5, $6, $7, $8, $9,
         $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT ("organizationId", "movementId") DO NOTHING
    `,
    event.organizationId,
    movement.id,
    createdAt,
    movementType,
    movement.item.id,
    movement.item.code,
    movement.item.name,
    movement.item.warehouseId ?? null,
    movement.item.warehouse?.code ?? null,
    quantity,
    unitCost,
    totalCost,
    movement.reference ?? null,
    movement.description ?? null,
    movement.performedBy ?? null,
    movement.fromWarehouseId ?? null,
    movement.toWarehouseId ?? null,
  )

  const daily = pickDailyTotals(movementType, totalCost)
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "rm_stock_value_daily"
        ("organizationId", "warehouseId", "day", "movementCount", "totalInCost", "totalOutCost", "totalAdjustmentCost")
      VALUES
        ($1, $2, $3::date, 1, $4, $5, $6)
      ON CONFLICT ("organizationId", "warehouseId", "day") DO UPDATE SET
        "movementCount" = "rm_stock_value_daily"."movementCount" + 1,
        "totalInCost" = "rm_stock_value_daily"."totalInCost" + EXCLUDED."totalInCost",
        "totalOutCost" = "rm_stock_value_daily"."totalOutCost" + EXCLUDED."totalOutCost",
        "totalAdjustmentCost" = "rm_stock_value_daily"."totalAdjustmentCost" + EXCLUDED."totalAdjustmentCost",
        "updatedAt" = CURRENT_TIMESTAMP
    `,
    event.organizationId,
    movement.item.warehouseId ?? null,
    day,
    daily.totalInCost,
    daily.totalOutCost,
    daily.totalAdjustmentCost,
  )
}

export async function rebuildWarehouseReadModels(input?: { organizationId?: string }) {
  await ensureWarehouseReadModelSchema()

  const organizationId = input?.organizationId?.trim() || null

  await prisma.$transaction(async (tx) => {
    if (organizationId) {
      await tx.$executeRawUnsafe(`DELETE FROM "rm_movement_fact" WHERE "organizationId" = $1`, organizationId)
      await tx.$executeRawUnsafe(`DELETE FROM "rm_stock_value_daily" WHERE "organizationId" = $1`, organizationId)
    } else {
      await tx.$executeRawUnsafe(`TRUNCATE TABLE "rm_movement_fact"`)
      await tx.$executeRawUnsafe(`TRUNCATE TABLE "rm_stock_value_daily"`)
    }

    await tx.$executeRawUnsafe(
      `
        INSERT INTO "rm_movement_fact"
          ("organizationId", "movementId", "createdAt", "movementType",
           "itemId", "itemCode", "itemName", "warehouseId", "warehouseCode",
           "quantity", "unitCost", "totalCost", "reference", "description", "performedBy", "fromWarehouseId", "toWarehouseId")
        SELECT
          m."organizationId",
          m."id" as "movementId",
          m."createdAt",
          m."movementType",
          i."id" as "itemId",
          i."code" as "itemCode",
          i."name" as "itemName",
          i."warehouseId",
          w."code" as "warehouseCode",
          m."quantity",
          COALESCE(m."unitCost", 0),
          COALESCE(m."totalCost", 0),
          m."reference",
          m."description",
          m."performedBy",
          m."fromWarehouseId",
          m."toWarehouseId"
        FROM "InventoryMovement" m
        JOIN "InventoryItem" i ON i."id" = m."itemId"
        LEFT JOIN "Warehouse" w ON w."id" = i."warehouseId"
        WHERE ($1::text IS NULL OR m."organizationId" = $1)
      `,
      organizationId,
    )

    await tx.$executeRawUnsafe(
      `
        INSERT INTO "rm_stock_value_daily"
          ("organizationId", "warehouseId", "day", "movementCount", "totalInCost", "totalOutCost", "totalAdjustmentCost")
        SELECT
          m."organizationId",
          i."warehouseId",
          DATE(m."createdAt") as "day",
          COUNT(*)::int as "movementCount",
          SUM(CASE WHEN m."movementType" = 'IN' THEN COALESCE(m."totalCost", 0) ELSE 0 END) as "totalInCost",
          SUM(CASE WHEN m."movementType" IN ('OUT', 'TRANSFER') THEN COALESCE(m."totalCost", 0) ELSE 0 END) as "totalOutCost",
          SUM(CASE WHEN m."movementType" = 'ADJUSTMENT' THEN COALESCE(m."totalCost", 0) ELSE 0 END) as "totalAdjustmentCost"
        FROM "InventoryMovement" m
        JOIN "InventoryItem" i ON i."id" = m."itemId"
        WHERE ($1::text IS NULL OR m."organizationId" = $1)
        GROUP BY m."organizationId", i."warehouseId", DATE(m."createdAt")
      `,
      organizationId,
    )
  })
}
