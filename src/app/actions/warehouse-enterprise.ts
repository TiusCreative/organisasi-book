"use server"

import { prisma } from "@/lib/prisma"
import { requireModuleAccess } from "@/lib/auth"
import { ensureWarehouseEnterpriseSchema } from "@/lib/warehouse-enterprise-schema"
import { postInventoryMovementInTx } from "@/lib/inventory-ledger"
import { ensureStockBalanceSchema } from "@/lib/stock-balance-schema"

function normalizeText(value?: string | null) {
  const trimmed = (value ?? "").trim()
  return trimmed.length ? trimmed : undefined
}

function parseDateOnly(value?: string | null) {
  const v = normalizeText(value)
  if (!v) return undefined
  const date = new Date(v)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString().slice(0, 10)
}

export type LotBatchRow = {
  id: string
  organizationId: string
  itemId: string
  code: string
  expiryDate: string | null
  receivedAt: string | null
  status: string
  notes: string | null
  createdAt: string
  updatedAt: string
}

export async function createLotBatch(input: {
  itemId: string
  code: string
  expiryDate?: string
  receivedAt?: string
  notes?: string
}) {
  const { organization } = await requireModuleAccess("warehouse")
  await ensureWarehouseEnterpriseSchema()

  const itemId = normalizeText(input.itemId)
  const code = normalizeText(input.code)
  if (!itemId || !code) throw new Error("itemId/code wajib diisi")

  const item = await prisma.inventoryItem.findFirst({
    where: { id: itemId, organizationId: organization.id, status: "ACTIVE" },
    select: { id: true },
  })
  if (!item) throw new Error("Item tidak ditemukan atau bukan milik organisasi aktif")

  const expiry = parseDateOnly(input.expiryDate)
  const receivedAt = normalizeText(input.receivedAt) ? new Date(input.receivedAt as string) : null

  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `
      INSERT INTO "LotBatch" ("organizationId", "itemId", "code", "expiryDate", "receivedAt", "notes")
      VALUES ($1, $2, $3, $4::date, $5, $6)
      ON CONFLICT ("organizationId", "itemId", "code") DO UPDATE SET
        "expiryDate" = COALESCE(EXCLUDED."expiryDate", "LotBatch"."expiryDate"),
        "receivedAt" = COALESCE(EXCLUDED."receivedAt", "LotBatch"."receivedAt"),
        "notes" = COALESCE(EXCLUDED."notes", "LotBatch"."notes"),
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING "id"
    `,
    organization.id,
    itemId,
    code,
    expiry ?? null,
    receivedAt,
    input.notes ?? null,
  )

  return { success: true, id: rows[0]?.id }
}

export async function getLotBatchesForItem(input: { itemId: string }) {
  const { organization } = await requireModuleAccess("warehouse")
  await ensureWarehouseEnterpriseSchema()

  const itemId = normalizeText(input.itemId)
  if (!itemId) throw new Error("itemId wajib diisi")

  const rows = await prisma.$queryRawUnsafe<LotBatchRow[]>(
    `
      SELECT
        "id", "organizationId", "itemId", "code",
        CASE WHEN "expiryDate" IS NULL THEN NULL ELSE "expiryDate"::text END as "expiryDate",
        CASE WHEN "receivedAt" IS NULL THEN NULL ELSE "receivedAt"::text END as "receivedAt",
        "status", "notes",
        "createdAt"::text as "createdAt",
        "updatedAt"::text as "updatedAt"
      FROM "LotBatch"
      WHERE "organizationId" = $1 AND "itemId" = $2
      ORDER BY "expiryDate" ASC NULLS LAST, "createdAt" DESC
      LIMIT 200
    `,
    organization.id,
    itemId,
  )
  return rows
}

export async function suggestFefoLotForItem(input: { itemId: string }) {
  const { organization } = await requireModuleAccess("warehouse")
  await ensureWarehouseEnterpriseSchema()

  const itemId = normalizeText(input.itemId)
  if (!itemId) throw new Error("itemId wajib diisi")

  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; code: string; expiryDate: string | null }>>(
    `
      SELECT
        "id",
        "code",
        CASE WHEN "expiryDate" IS NULL THEN NULL ELSE "expiryDate"::text END as "expiryDate"
      FROM "LotBatch"
      WHERE "organizationId" = $1
        AND "itemId" = $2
        AND "status" = 'ACTIVE'
        AND ("expiryDate" IS NULL OR "expiryDate" >= CURRENT_DATE)
      ORDER BY "expiryDate" ASC NULLS LAST, "createdAt" ASC
      LIMIT 1
    `,
    organization.id,
    itemId,
  )
  return rows[0] ?? null
}

export type PickWaveRow = {
  id: string
  code: string
  status: string
  warehouseId: string
  notes: string | null
  createdAt: string
}

export type PickTaskRow = {
  id: string
  waveId: string | null
  warehouseId: string
  orderReference: string | null
  itemId: string
  quantity: number
  fromBinId: string | null
  lotBatchId: string | null
  status: string
  assignedTo: string | null
  startedAt: string | null
  doneAt: string | null
  movementId: string | null
  notes: string | null
  createdAt: string
}

async function insertScanEventInTx(
  tx: { $executeRawUnsafe: (sql: string, ...values: unknown[]) => Promise<number> },
  input: {
    organizationId: string
    eventType: string
    barcode: string
    itemId?: string | null
    binId?: string | null
    taskType?: string | null
    taskId?: string | null
    movementId?: string | null
    scannedBy?: string | null
    metadata?: unknown
  },
) {
  await tx.$executeRawUnsafe(
    `
      INSERT INTO "WarehouseScanEvent"
        ("organizationId", "eventType", "barcode", "itemId", "binId", "taskType", "taskId", "movementId", "scannedBy", "metadata")
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
    `,
    input.organizationId,
    input.eventType,
    input.barcode,
    input.itemId ?? null,
    input.binId ?? null,
    input.taskType ?? null,
    input.taskId ?? null,
    input.movementId ?? null,
    input.scannedBy ?? null,
    JSON.stringify(input.metadata ?? {}),
  )
}

async function resolveBinIdInTx(
  tx: { $queryRawUnsafe: <T>(sql: string, ...values: unknown[]) => Promise<T> },
  organizationId: string,
  warehouseId: string,
  binCodeOrBarcode?: string,
) {
  const value = normalizeText(binCodeOrBarcode)
  if (!value) return null
  const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
    `
      SELECT "id"
      FROM "WarehouseBin"
      WHERE "organizationId" = $1
        AND "warehouseId" = $2
        AND ("code" = $3 OR "barcode" = $3)
      LIMIT 1
    `,
    organizationId,
    warehouseId,
    value,
  )
  return rows[0]?.id ?? null
}

export async function createPickWaveAndTasks(input: {
  warehouseId: string
  code?: string
  notes?: string
  tasks: Array<{
    orderReference?: string
    itemId: string
    quantity: number
    fromBin?: string
    lotBatchCode?: string
    notes?: string
  }>
}) {
  const { organization, user } = await requireModuleAccess("warehouse")
  await ensureWarehouseEnterpriseSchema()

  const warehouseId = normalizeText(input.warehouseId)
  if (!warehouseId) throw new Error("warehouseId wajib diisi")

  const waveCode = normalizeText(input.code) ?? `WAVE-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(16).slice(2, 6).toUpperCase()}`

  if (!input.tasks?.length) throw new Error("tasks wajib diisi")

  const result = await prisma.$transaction(async (tx) => {
    const waveRows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
      `
        INSERT INTO "PickWave" ("organizationId", "warehouseId", "code", "status", "notes", "createdBy")
        VALUES ($1, $2, $3, 'OPEN', $4, $5)
        RETURNING "id"
      `,
      organization.id,
      warehouseId,
      waveCode,
      input.notes ?? null,
      user.id,
    )
    const waveId = waveRows[0]?.id
    if (!waveId) throw new Error("Gagal membuat pick wave")

    for (const task of input.tasks) {
      const itemId = normalizeText(task.itemId)
      const qty = Number(task.quantity || 0)
      if (!itemId || qty <= 0) throw new Error("Item/qty pada task tidak valid")

      const item = await tx.inventoryItem.findFirst({
        where: { id: itemId, organizationId: organization.id, warehouseId },
        select: { id: true },
      })
      if (!item) throw new Error("Item pada task tidak ditemukan atau bukan milik warehouse aktif")

      const fromBinId = await resolveBinIdInTx(tx, organization.id, warehouseId, task.fromBin)

      let lotBatchId: string | null = null
      const lotBatchCode = normalizeText(task.lotBatchCode)
      if (lotBatchCode) {
        const lotRows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
          `
            SELECT "id"
            FROM "LotBatch"
            WHERE "organizationId" = $1 AND "itemId" = $2 AND "code" = $3
            LIMIT 1
          `,
          organization.id,
          itemId,
          lotBatchCode,
        )
        lotBatchId = lotRows[0]?.id ?? null
      } else {
        const suggestion = await tx.$queryRawUnsafe<Array<{ id: string }>>(
          `
            SELECT "id"
            FROM "LotBatch"
            WHERE "organizationId" = $1
              AND "itemId" = $2
              AND "status" = 'ACTIVE'
              AND ("expiryDate" IS NULL OR "expiryDate" >= CURRENT_DATE)
            ORDER BY "expiryDate" ASC NULLS LAST, "createdAt" ASC
            LIMIT 1
          `,
          organization.id,
          itemId,
        )
        lotBatchId = suggestion[0]?.id ?? null
      }

      await tx.$queryRawUnsafe(
        `
          INSERT INTO "PickTask"
            ("organizationId", "warehouseId", "waveId", "orderReference", "itemId", "quantity", "fromBinId", "lotBatchId", "status", "createdBy", "notes")
          VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, 'OPEN', $9, $10)
        `,
        organization.id,
        warehouseId,
        waveId,
        task.orderReference ?? null,
        itemId,
        qty,
        fromBinId,
        lotBatchId,
        user.id,
        task.notes ?? null,
      )
    }

    return { waveId, waveCode }
  })

  return { success: true, ...result }
}

export async function listPickWaves(input?: { warehouseId?: string }) {
  const { organization } = await requireModuleAccess("warehouse")
  await ensureWarehouseEnterpriseSchema()

  const warehouseId = normalizeText(input?.warehouseId)
  const clause = warehouseId ? ` AND "warehouseId" = $2` : ""
  const params = warehouseId ? [organization.id, warehouseId] : [organization.id]

  const rows = await prisma.$queryRawUnsafe<PickWaveRow[]>(
    `
      SELECT "id", "code", "status", "warehouseId", "notes",
             "createdAt"::text as "createdAt"
      FROM "PickWave"
      WHERE "organizationId" = $1${clause}
      ORDER BY "createdAt" DESC
      LIMIT 120
    `,
    ...params,
  )
  return rows
}

export async function listPickTasks(input?: { waveId?: string; status?: string; warehouseId?: string }) {
  const { organization } = await requireModuleAccess("warehouse")
  await ensureWarehouseEnterpriseSchema()

  const waveId = normalizeText(input?.waveId)
  const status = normalizeText(input?.status)
  const warehouseId = normalizeText(input?.warehouseId)

  const where: string[] = [`"organizationId" = $1`]
  const params: string[] = [organization.id]

  if (warehouseId) {
    params.push(warehouseId)
    where.push(`"warehouseId" = $${params.length}`)
  }
  if (waveId) {
    params.push(waveId)
    where.push(`"waveId" = $${params.length}`)
  }
  if (status) {
    params.push(status)
    where.push(`"status" = $${params.length}`)
  }

  const rows = await prisma.$queryRawUnsafe<PickTaskRow[]>(
    `
      SELECT
        "id",
        "waveId",
        "warehouseId",
        "orderReference",
        "itemId",
        "quantity",
        "fromBinId",
        "lotBatchId",
        "status",
        "assignedTo",
        CASE WHEN "startedAt" IS NULL THEN NULL ELSE "startedAt"::text END as "startedAt",
        CASE WHEN "doneAt" IS NULL THEN NULL ELSE "doneAt"::text END as "doneAt",
        "movementId",
        "notes",
        "createdAt"::text as "createdAt"
      FROM "PickTask"
      WHERE ${where.join(" AND ")}
      ORDER BY "createdAt" DESC
      LIMIT 500
    `,
    ...params,
  )
  return rows
}

export async function startPickTask(input: { taskId: string }) {
  const { organization, user } = await requireModuleAccess("warehouse")
  await ensureWarehouseEnterpriseSchema()

  const taskId = normalizeText(input.taskId)
  if (!taskId) throw new Error("taskId wajib diisi")

  const updated = await prisma.$executeRawUnsafe(
    `
      UPDATE "PickTask"
      SET "status" = 'IN_PROGRESS',
          "assignedTo" = COALESCE("assignedTo", $1),
          "startedAt" = COALESCE("startedAt", CURRENT_TIMESTAMP),
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = $2 AND "organizationId" = $3 AND "status" = 'OPEN'
    `,
    user.id,
    taskId,
    organization.id,
  )
  if (updated === 0) throw new Error("Task tidak ditemukan atau status bukan OPEN")
  return { success: true }
}

export async function completePickTask(input: {
  taskId: string
  scannedItem: string
  scannedBin?: string
  scannedLot?: string
}) {
  const { organization, user } = await requireModuleAccess("warehouse")
  await ensureWarehouseEnterpriseSchema()

  const taskId = normalizeText(input.taskId)
  const scannedItem = normalizeText(input.scannedItem)
  if (!taskId || !scannedItem) throw new Error("taskId/scannedItem wajib diisi")

  const result = await prisma.$transaction(async (tx) => {
    const taskRows = await tx.$queryRawUnsafe<
      Array<{
        id: string
        warehouseId: string
        waveId: string | null
        orderReference: string | null
        itemId: string
        quantity: number
        fromBinId: string | null
        lotBatchId: string | null
        status: string
      }>
    >(
      `
        SELECT "id", "warehouseId", "waveId", "orderReference", "itemId", "quantity", "fromBinId", "lotBatchId", "status"
        FROM "PickTask"
        WHERE "id" = $1 AND "organizationId" = $2
        LIMIT 1
        FOR UPDATE
      `,
      taskId,
      organization.id,
    )
    const task = taskRows[0]
    if (!task) throw new Error("Pick task tidak ditemukan")
    if (!["OPEN", "IN_PROGRESS"].includes(task.status)) throw new Error("Task sudah selesai / tidak bisa diproses")

    const item = await tx.inventoryItem.findFirst({
      where: { id: task.itemId, organizationId: organization.id, warehouseId: task.warehouseId },
      select: { id: true, code: true, barcode: true, name: true, unit: true, warehouseId: true, bin: true, unitCost: true },
    })
    if (!item) throw new Error("Item task tidak ditemukan")

    // Validate scan item (accept barcode or code).
    const okItem = scannedItem === item.code || (!!item.barcode && scannedItem === item.barcode)
    if (!okItem) {
      throw new Error("Scan item tidak cocok dengan task")
    }

    await insertScanEventInTx(tx, {
      organizationId: organization.id,
      eventType: "PICK_SCAN_ITEM",
      barcode: scannedItem,
      itemId: item.id,
      binId: task.fromBinId,
      taskType: "PickTask",
      taskId: task.id,
      scannedBy: user.id,
      metadata: { itemCode: item.code },
    })

    const scannedBin = normalizeText(input.scannedBin)
    let resolvedFromBinId: string | null = task.fromBinId
    if (task.fromBinId || item.bin) {
      if (!scannedBin) throw new Error("Scan bin wajib untuk task ini")

      const binRows = task.fromBinId
        ? await tx.$queryRawUnsafe<Array<{ id: string; code: string; barcode: string | null }>>(
            `SELECT "id", "code", "barcode" FROM "WarehouseBin" WHERE "id" = $1 AND "organizationId" = $2 LIMIT 1`,
            task.fromBinId,
            organization.id,
          )
        : await tx.$queryRawUnsafe<Array<{ id: string; code: string; barcode: string | null }>>(
            `SELECT "id", "code", "barcode" FROM "WarehouseBin" WHERE "organizationId" = $1 AND "warehouseId" = $2 AND "code" = $3 LIMIT 1`,
            organization.id,
            item.warehouseId,
            item.bin,
          )

      const bin = binRows[0]
      const okBin =
        !!bin && (scannedBin === bin.code || (!!bin.barcode && scannedBin === bin.barcode) || scannedBin === (item.bin ?? ""))
      if (!okBin) throw new Error("Scan bin tidak cocok dengan task/lokasi item")
      resolvedFromBinId = bin?.id ?? resolvedFromBinId

      await insertScanEventInTx(tx, {
        organizationId: organization.id,
        eventType: "PICK_SCAN_BIN",
        barcode: scannedBin,
        itemId: item.id,
        binId: bin?.id ?? task.fromBinId ?? null,
        taskType: "PickTask",
        taskId: task.id,
        scannedBy: user.id,
        metadata: { expectedBin: bin?.code ?? item.bin ?? null },
      })
    }

    // Validate lot if provided/required.
    const scannedLot = normalizeText(input.scannedLot)
    let lotBatchId = task.lotBatchId
    if (scannedLot) {
      const lotRows = await tx.$queryRawUnsafe<Array<{ id: string; expiryDate: Date | null }>>(
        `
          SELECT "id", "expiryDate"
          FROM "LotBatch"
          WHERE "organizationId" = $1 AND "itemId" = $2 AND "code" = $3
          LIMIT 1
        `,
        organization.id,
        item.id,
        scannedLot,
      )
      const lot = lotRows[0]
      if (!lot) throw new Error("Lot tidak ditemukan untuk item ini")
      if (lot.expiryDate && lot.expiryDate < new Date(new Date().toISOString().slice(0, 10))) {
        throw new Error("Lot sudah expired")
      }
      lotBatchId = lot.id

      await insertScanEventInTx(tx, {
        organizationId: organization.id,
        eventType: "PICK_SCAN_LOT",
        barcode: scannedLot,
        itemId: item.id,
        binId: task.fromBinId,
        taskType: "PickTask",
        taskId: task.id,
        scannedBy: user.id,
        metadata: { lotBatchId: lot.id },
      })
    }
    if (task.lotBatchId && !scannedLot) {
      throw new Error("Scan lot wajib untuk task ini")
    }

    const reference = task.orderReference || (task.waveId ? `WAVE:${task.waveId}` : "PICK")
    const movement = await postInventoryMovementInTx(tx, {
      organizationId: organization.id,
      itemId: item.id,
      movementType: "OUT",
      quantity: Number(task.quantity || 0),
      unitCost: Number(item.unitCost || 0),
      reference,
      description: `Pick task ${task.id} OUT ${item.code} qty ${task.quantity} ${item.unit}`,
      fromBinId: resolvedFromBinId ?? undefined,
      lotBatchId: lotBatchId ?? undefined,
      performedBy: user.id,
      idempotencyKey: `PICK:${task.id}`,
    })

    await tx.$executeRawUnsafe(
      `
        INSERT INTO "InventoryMovementEvidence"
          ("organizationId", "movementId", "taskType", "taskId", "waveId", "fromBinId", "lotBatchId")
        VALUES ($1, $2, 'PickTask', $3, $4, $5, $6)
        ON CONFLICT ("organizationId", "movementId") DO NOTHING
      `,
      organization.id,
      movement.id,
      task.id,
      task.waveId,
      resolvedFromBinId,
      lotBatchId,
    )

    await insertScanEventInTx(tx, {
      organizationId: organization.id,
      eventType: "PICK_POST_MOVEMENT",
      barcode: movement.id,
      itemId: item.id,
      binId: task.fromBinId,
      taskType: "PickTask",
      taskId: task.id,
      movementId: movement.id,
      scannedBy: user.id,
      metadata: { movementType: "OUT" },
    })

    await tx.$executeRawUnsafe(
      `
        UPDATE "PickTask"
        SET "status" = 'DONE',
            "assignedTo" = COALESCE("assignedTo", $1),
            "doneAt" = CURRENT_TIMESTAMP,
            "movementId" = $2,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $3 AND "organizationId" = $4
      `,
      user.id,
      movement.id,
      task.id,
      organization.id,
    )

    return { movementId: movement.id }
  })

  return { success: true, ...result }
}

export async function createPutawayTask(input: {
  warehouseId: string
  itemId: string
  quantity: number
  inboundReference?: string
  stagingBin?: string
  targetBin?: string
  notes?: string
}) {
  const { organization, user } = await requireModuleAccess("warehouse")
  await ensureWarehouseEnterpriseSchema()

  const warehouseId = normalizeText(input.warehouseId)
  const itemId = normalizeText(input.itemId)
  const qty = Number(input.quantity || 0)
  if (!warehouseId || !itemId || qty <= 0) throw new Error("warehouseId/itemId/quantity wajib diisi")

  const [stagingBinId, targetBinId] = await prisma.$transaction(async (tx) => {
    const staging = await resolveBinIdInTx(tx, organization.id, warehouseId, input.stagingBin)
    const target = await resolveBinIdInTx(tx, organization.id, warehouseId, input.targetBin)
    return [staging, target] as const
  })

  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `
      INSERT INTO "PutawayTask"
        ("organizationId", "warehouseId", "inboundReference", "itemId", "quantity", "stagingBinId", "targetBinId", "status", "createdBy", "notes")
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, 'OPEN', $8, $9)
      RETURNING "id"
    `,
    organization.id,
    warehouseId,
    input.inboundReference ?? null,
    itemId,
    qty,
    stagingBinId,
    targetBinId,
    user.id,
    input.notes ?? null,
  )

  return { success: true, id: rows[0]?.id }
}

export async function completePutawayTask(input: { taskId: string; scannedTargetBin: string }) {
  const { organization, user } = await requireModuleAccess("warehouse")
  await ensureWarehouseEnterpriseSchema()

  const taskId = normalizeText(input.taskId)
  const scannedTargetBin = normalizeText(input.scannedTargetBin)
  if (!taskId || !scannedTargetBin) throw new Error("taskId/scannedTargetBin wajib diisi")

  await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<
      Array<{
        id: string
        warehouseId: string
        itemId: string
        quantity: number
        stagingBinId: string | null
        targetBinId: string | null
        status: string
        inboundReference: string | null
      }>
    >(
      `
        SELECT "id", "warehouseId", "itemId", "quantity", "stagingBinId", "targetBinId", "status", "inboundReference"
        FROM "PutawayTask"
        WHERE "id" = $1 AND "organizationId" = $2
        LIMIT 1
        FOR UPDATE
      `,
      taskId,
      organization.id,
    )
    const task = rows[0]
    if (!task) throw new Error("Putaway task tidak ditemukan")
    if (!["OPEN", "IN_PROGRESS"].includes(task.status)) throw new Error("Task sudah selesai / tidak bisa diproses")

    const binRows = task.targetBinId
      ? await tx.$queryRawUnsafe<Array<{ id: string; code: string; barcode: string | null }>>(
          `SELECT "id", "code", "barcode" FROM "WarehouseBin" WHERE "id" = $1 AND "organizationId" = $2 LIMIT 1`,
          task.targetBinId,
          organization.id,
        )
      : await tx.$queryRawUnsafe<Array<{ id: string; code: string; barcode: string | null }>>(
          `SELECT "id", "code", "barcode" FROM "WarehouseBin" WHERE "organizationId" = $1 AND "warehouseId" = $2 AND ("code" = $3 OR "barcode" = $3) LIMIT 1`,
          organization.id,
          task.warehouseId,
          scannedTargetBin,
        )
    const bin = binRows[0]
    if (!bin) throw new Error("Bin target tidak ditemukan")
    const ok = scannedTargetBin === bin.code || (!!bin.barcode && scannedTargetBin === bin.barcode)
    if (!ok) throw new Error("Scan bin target tidak cocok")

    await insertScanEventInTx(tx, {
      organizationId: organization.id,
      eventType: "PUTAWAY_SCAN_TARGET_BIN",
      barcode: scannedTargetBin,
      itemId: task.itemId,
      binId: bin.id,
      taskType: "PutawayTask",
      taskId: task.id,
      scannedBy: user.id,
      metadata: { targetBinCode: bin.code },
    })

    const item = await tx.inventoryItem.findFirst({
      where: { id: task.itemId, organizationId: organization.id, warehouseId: task.warehouseId },
      select: { id: true, code: true, unit: true, unitCost: true, bin: true },
    })
    if (!item) throw new Error("Item putaway tidak ditemukan")

    const qty = Number(task.quantity || 0)
    if (qty <= 0) throw new Error("Qty task putaway tidak valid")

    // If stagingBinId exists, do a bin transfer via two movements (OUT staging, IN target) with same unitCost.
    if (task.stagingBinId) {
      const ref = task.inboundReference || `PUTAWAY:${task.id}`
      const descriptionBase = `Putaway ${task.id} ${item.code} qty ${qty} ${item.unit}`

      const movementOut = await postInventoryMovementInTx(tx, {
        organizationId: organization.id,
        itemId: item.id,
        movementType: "OUT",
        quantity: qty,
        unitCost: Number(item.unitCost || 0),
        reference: ref,
        description: `${descriptionBase} (OUT staging)`,
        fromBinId: task.stagingBinId,
        performedBy: user.id,
        idempotencyKey: `PUTAWAY:${task.id}:OUT`,
      })

      const movementIn = await postInventoryMovementInTx(tx, {
        organizationId: organization.id,
        itemId: item.id,
        movementType: "IN",
        quantity: qty,
        unitCost: Number(item.unitCost || 0),
        reference: ref,
        description: `${descriptionBase} (IN target)`,
        toBinId: bin.id,
        performedBy: user.id,
        idempotencyKey: `PUTAWAY:${task.id}:IN`,
      })

      await tx.$executeRawUnsafe(
        `
          INSERT INTO "InventoryMovementEvidence"
            ("organizationId", "movementId", "taskType", "taskId", "fromBinId", "toBinId")
          VALUES ($1, $2, 'PutawayTask', $3, $4, $5)
          ON CONFLICT ("organizationId", "movementId") DO NOTHING
        `,
        organization.id,
        movementOut.id,
        task.id,
        task.stagingBinId,
        bin.id,
      )
      await tx.$executeRawUnsafe(
        `
          INSERT INTO "InventoryMovementEvidence"
            ("organizationId", "movementId", "taskType", "taskId", "fromBinId", "toBinId")
          VALUES ($1, $2, 'PutawayTask', $3, $4, $5)
          ON CONFLICT ("organizationId", "movementId") DO NOTHING
        `,
        organization.id,
        movementIn.id,
        task.id,
        task.stagingBinId,
        bin.id,
      )
    }

    // Backward-compatible: keep primary bin mapping on InventoryItem in sync with the chosen target.
    await tx.inventoryItem.updateMany({
      where: { id: task.itemId, organizationId: organization.id, warehouseId: task.warehouseId },
      data: { bin: bin.code },
    })

    await tx.$executeRawUnsafe(
      `
        UPDATE "PutawayTask"
        SET "status" = 'DONE',
            "assignedTo" = COALESCE("assignedTo", $1),
            "doneAt" = CURRENT_TIMESTAMP,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $2 AND "organizationId" = $3
      `,
      user.id,
      task.id,
      organization.id,
    )
  })

  return { success: true }
}

export type StockBalanceRow = {
  id: string
  itemId: string
  itemCode: string
  itemName: string
  warehouseId: string
  binId: string | null
  binCode: string | null
  lotBatchId: string | null
  lotCode: string | null
  quantity: number
  updatedAt: string
}

export async function getStockBalances(input: { warehouseId: string }) {
  const { organization } = await requireModuleAccess("warehouse")
  await Promise.all([ensureWarehouseEnterpriseSchema(), ensureStockBalanceSchema()])

  const warehouseId = normalizeText(input.warehouseId)
  if (!warehouseId) throw new Error("warehouseId wajib diisi")

  const rows = await prisma.$queryRawUnsafe<StockBalanceRow[]>(
    `
      SELECT
        sb."id",
        sb."itemId",
        i."code" as "itemCode",
        i."name" as "itemName",
        sb."warehouseId",
        sb."binId",
        b."code" as "binCode",
        sb."lotBatchId",
        lb."code" as "lotCode",
        sb."quantity",
        sb."updatedAt"::text as "updatedAt"
      FROM "StockBalance" sb
      JOIN "InventoryItem" i ON i."id" = sb."itemId"
      LEFT JOIN "WarehouseBin" b ON b."id" = sb."binId"
      LEFT JOIN "LotBatch" lb ON lb."id" = sb."lotBatchId"
      WHERE sb."organizationId" = $1
        AND sb."warehouseId" = $2
        AND sb."quantity" <> 0
      ORDER BY i."code" ASC, b."code" ASC NULLS LAST, lb."code" ASC NULLS LAST
      LIMIT 400
    `,
    organization.id,
    warehouseId,
  )

  return rows
}

async function resolveLotBatchIdInTx(
  tx: { $queryRawUnsafe: <T>(sql: string, ...values: unknown[]) => Promise<T> },
  input: { organizationId: string; itemId: string; lotCode?: string },
) {
  const lotCode = normalizeText(input.lotCode)
  if (!lotCode) return null
  const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
    `
      SELECT "id"
      FROM "LotBatch"
      WHERE "organizationId" = $1 AND "itemId" = $2 AND "code" = $3
      LIMIT 1
    `,
    input.organizationId,
    input.itemId,
    lotCode,
  )
  return rows[0]?.id ?? null
}

export async function inboundToStagingAndCreatePutaway(input: {
  warehouseId: string
  itemId: string
  quantity: number
  unitCost?: number
  inboundReference?: string
  stagingBin: string
  targetBin?: string
  lotCode?: string
  lotExpiryDate?: string
  notes?: string
}) {
  const { organization, user } = await requireModuleAccess("warehouse")
  await Promise.all([ensureWarehouseEnterpriseSchema(), ensureStockBalanceSchema()])

  const warehouseId = normalizeText(input.warehouseId)
  const itemId = normalizeText(input.itemId)
  const qty = Number(input.quantity || 0)
  const stagingBin = normalizeText(input.stagingBin)
  if (!warehouseId || !itemId || !stagingBin) throw new Error("warehouseId/itemId/stagingBin wajib diisi")
  if (qty <= 0) throw new Error("Qty inbound harus > 0")

  const targetBin = normalizeText(input.targetBin)
  const inboundReference = normalizeText(input.inboundReference) ?? `INB-${new Date().toISOString().slice(0, 10)}`

  const result = await prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findFirst({
      where: { id: itemId, organizationId: organization.id, warehouseId },
      select: { id: true, code: true, unit: true, unitCost: true },
    })
    if (!item) throw new Error("Item tidak ditemukan atau bukan milik warehouse aktif")

    const stagingBinId = await resolveBinIdInTx(tx, organization.id, warehouseId, stagingBin)
    if (!stagingBinId) throw new Error("Staging bin tidak ditemukan (code/barcode)")

    const targetBinId = targetBin ? await resolveBinIdInTx(tx, organization.id, warehouseId, targetBin) : null

    let lotBatchId: string | null = null
    const lotCode = normalizeText(input.lotCode)
    if (lotCode) {
      const expiry = parseDateOnly(input.lotExpiryDate)
      const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `
          INSERT INTO "LotBatch" ("organizationId", "itemId", "code", "expiryDate", "receivedAt", "notes")
          VALUES ($1, $2, $3, $4::date, CURRENT_TIMESTAMP, $5)
          ON CONFLICT ("organizationId", "itemId", "code") DO UPDATE SET
            "expiryDate" = COALESCE(EXCLUDED."expiryDate", "LotBatch"."expiryDate"),
            "receivedAt" = COALESCE("LotBatch"."receivedAt", EXCLUDED."receivedAt"),
            "updatedAt" = CURRENT_TIMESTAMP
          RETURNING "id"
        `,
        organization.id,
        itemId,
        lotCode,
        expiry ?? null,
        input.notes ?? null,
      )
      lotBatchId = rows[0]?.id ?? null
    } else {
      lotBatchId = await resolveLotBatchIdInTx(tx, { organizationId: organization.id, itemId })
    }

    const unitCost = Number(input.unitCost ?? item.unitCost ?? 0)
    const movement = await postInventoryMovementInTx(tx, {
      organizationId: organization.id,
      itemId: item.id,
      movementType: "IN",
      quantity: qty,
      unitCost,
      reference: inboundReference,
      description: `Inbound ${inboundReference} (staging) ${item.code} qty ${qty} ${item.unit}`,
      toBinId: stagingBinId,
      lotBatchId: lotBatchId ?? undefined,
      performedBy: user.id,
      idempotencyKey: `INB:${inboundReference}:${item.id}:${stagingBinId}:${lotBatchId ?? "NOL"}:${qty}`,
    })

    const putawayRows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
      `
        INSERT INTO "PutawayTask"
          ("organizationId", "warehouseId", "inboundReference", "itemId", "quantity", "stagingBinId", "targetBinId", "status", "createdBy", "notes")
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, 'OPEN', $8, $9)
        RETURNING "id"
      `,
      organization.id,
      warehouseId,
      inboundReference,
      item.id,
      qty,
      stagingBinId,
      targetBinId,
      user.id,
      input.notes ?? null,
    )

    return { movementId: movement.id, putawayTaskId: putawayRows[0]?.id ?? null }
  })

  return { success: true, ...result }
}
