"use server"

import { prisma } from "@/lib/prisma"
import { requireModuleAccess, requireWritableModuleAccess } from "@/lib/auth"
import { ensureWarehouseLocationSchema } from "@/lib/warehouse-location-schema"
import { ensureWarehouseTransferSchema } from "@/lib/warehouse-transfer-schema"
import type { Prisma } from "@prisma/client"
import { ensureInventoryAccountingSchema } from "@/lib/inventory-accounting-schema"
import { getInventoryAccountingConfigInTx, upsertInventoryAccountingConfigInTx } from "@/lib/inventory-accounting"
import {
  createInventoryItem,
  createInventoryMovement,
  createStockOpname,
  getInventoryItems,
  getStockOpnames,
} from "@/app/actions/inventory"
import { postInventoryMovementInTx } from "@/lib/inventory-ledger"

function parseDateOrUndefined(value?: string) {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return date
}

function normalizeText(value?: string) {
  const trimmed = (value ?? "").trim()
  return trimmed.length ? trimmed : undefined
}

export async function getWarehouseModuleBootstrap() {
  const { organization } = await requireModuleAccess("warehouse")
  await ensureInventoryAccountingSchema()

  const [warehouses, users, accounts, accountingConfig] = await Promise.all([
    prisma.warehouse.findMany({
      where: { organizationId: organization.id },
      include: { manager: { select: { id: true, name: true, email: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.user.findMany({
      where: { organizationId: organization.id, status: "ACTIVE" },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.chartOfAccount.findMany({
      where: { organizationId: organization.id },
      select: { id: true, code: true, name: true, type: true, isHeader: true },
      orderBy: [{ code: "asc" }],
      take: 2500,
    }),
    prisma.$transaction(async (tx) => getInventoryAccountingConfigInTx(tx, organization.id)),
  ])

  return { organization, warehouses, users, accounts, accountingConfig }
}

export async function upsertWarehouseAccountingConfig(input: {
  inventoryAccountId?: string | null
  wipAccountId?: string | null
  finishedGoodsAccountId?: string | null
  inventoryVarianceAccountId?: string | null
  cogsAccountId?: string | null
}) {
  const { organization } = await requireWritableModuleAccess("warehouse")
  await ensureInventoryAccountingSchema()

  await prisma.$transaction(async (tx) => {
    await upsertInventoryAccountingConfigInTx(tx, {
      organizationId: organization.id,
      inventoryAccountId: input.inventoryAccountId ?? null,
      wipAccountId: input.wipAccountId ?? null,
      finishedGoodsAccountId: input.finishedGoodsAccountId ?? null,
      inventoryVarianceAccountId: input.inventoryVarianceAccountId ?? null,
      cogsAccountId: input.cogsAccountId ?? null,
    })
  })

  return { success: true }
}

export async function getWarehouseAccountingReconciliation(filters: WarehouseReportFilters) {
  const { organization } = await requireModuleAccess("warehouse")
  await ensureInventoryAccountingSchema()

  const warehouseId = normalizeText(filters.warehouseId)
  const startDate = parseDateOrUndefined(filters.startDate)
  const endDate = parseDateOrUndefined(filters.endDate)

  const result = await prisma.$transaction(async (tx) => {
    const cfg = await getInventoryAccountingConfigInTx(tx, organization.id)
    if (!cfg?.inventoryAccountId) {
      return { enabled: false as const }
    }

    const inventoryValue = await tx.inventoryItem.aggregate({
      where: {
        organizationId: organization.id,
        ...(warehouseId ? { warehouseId } : {}),
        status: "ACTIVE",
      },
      _sum: { totalValue: true },
    })

    const gl = await tx.transactionLine.aggregate({
      where: {
        accountId: cfg.inventoryAccountId,
        transaction: {
          organizationId: organization.id,
          ...(startDate || endDate
            ? {
                date: {
                  ...(startDate ? { gte: startDate } : {}),
                  ...(endDate ? { lte: endDate } : {}),
                },
              }
            : {}),
        },
      },
      _sum: { debit: true, credit: true },
    })

    const debit = Number(gl._sum.debit || 0)
    const credit = Number(gl._sum.credit || 0)
    const glBalance = debit - credit
    const invValue = Number(inventoryValue._sum.totalValue || 0)

    return {
      enabled: true as const,
      inventoryAccountId: cfg.inventoryAccountId,
      inventoryValue: invValue,
      glBalance,
      difference: invValue - glBalance,
    }
  })

  return result
}

export type WarehouseReportFilters = {
  warehouseId?: string
  q?: string
  movementType?: string
  startDate?: string
  endDate?: string
  opnameStatus?: string
}

export async function getWarehouseReportData(filters: WarehouseReportFilters) {
  const { organization } = await requireModuleAccess("warehouse")
  await ensureWarehouseTransferSchema()

  const warehouseId = normalizeText(filters.warehouseId)
  const q = normalizeText(filters.q)
  const movementType = normalizeText(filters.movementType)
  const opnameStatus = normalizeText(filters.opnameStatus)
  const startDate = parseDateOrUndefined(filters.startDate)
  const endDate = parseDateOrUndefined(filters.endDate)

  const itemWhere: any = { organizationId: organization.id, status: "ACTIVE" }
  if (warehouseId) itemWhere.warehouseId = warehouseId
  if (q) {
    itemWhere.OR = [
      { code: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
      { barcode: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } },
    ]
  }

  const movementWhere: any = { organizationId: organization.id }
  if (movementType) movementWhere.movementType = movementType
  if (startDate || endDate) {
    movementWhere.createdAt = {}
    if (startDate) movementWhere.createdAt.gte = startDate
    if (endDate) movementWhere.createdAt.lte = endDate
  }
  if (warehouseId) {
    movementWhere.item = { is: { warehouseId } }
  }
  if (q) {
    movementWhere.item = movementWhere.item || {}
    movementWhere.item.is = movementWhere.item.is || {}
    movementWhere.item.is.OR = [
      { code: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
      { barcode: { contains: q, mode: "insensitive" } },
    ]
  }

  const opnameWhere: any = { organizationId: organization.id }
  if (warehouseId) opnameWhere.warehouseId = warehouseId
  if (opnameStatus) opnameWhere.status = opnameStatus
  if (startDate || endDate) {
    opnameWhere.opnameDate = {}
    if (startDate) opnameWhere.opnameDate.gte = startDate
    if (endDate) opnameWhere.opnameDate.lte = endDate
  }

  const transferWhereClause =
    warehouseId
      ? ` AND ("fromWarehouseId" = $2 OR "toWarehouseId" = $2)`
      : ""
  const transferParams = warehouseId ? [organization.id, warehouseId] : [organization.id]

  const [items, movements, stockOpnames, transferOrders] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: itemWhere,
      include: { warehouse: { select: { id: true, code: true, name: true } } },
      orderBy: [{ warehouseId: "asc" }, { code: "asc" }],
      take: 1500,
    }),
    prisma.inventoryMovement.findMany({
      where: movementWhere,
      include: {
        item: {
          select: {
            id: true,
            code: true,
            barcode: true,
            name: true,
            unit: true,
            warehouse: { select: { id: true, code: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 800,
    }),
    prisma.stockOpname.findMany({
      where: opnameWhere,
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        items: {
          include: { item: { select: { id: true, code: true, name: true, unit: true } } },
        },
      },
      orderBy: { opnameDate: "desc" },
      take: 300,
    }),
    prisma.$queryRawUnsafe<
      Array<{
        id: string
        organizationId: string
        code: string
        status: string
        fromWarehouseId: string
        toWarehouseId: string
        notes: string | null
        createdBy: string | null
        approvedBy: string | null
        approvedAt: Date | null
        movementOutId: string | null
        movementInId: string | null
        createdAt: Date
        updatedAt: Date
      }>
    >(
      `SELECT * FROM "TransferOrder" WHERE "organizationId" = $1${transferWhereClause} ORDER BY "createdAt" DESC LIMIT 200`,
      ...transferParams,
    ),
  ])

  return { items, movements, stockOpnames, transferOrders }
}

type WarehouseZoneRow = {
  id: string
  organizationId: string
  warehouseId: string
  code: string
  name: string
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

type WarehouseAisleRow = {
  id: string
  organizationId: string
  warehouseId: string
  zoneId: string | null
  code: string
  name: string
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

type WarehouseRackRow = {
  id: string
  organizationId: string
  warehouseId: string
  aisleId: string | null
  code: string
  name: string
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

type WarehouseBinRow = {
  id: string
  organizationId: string
  warehouseId: string
  rackId: string | null
  code: string
  name: string
  barcode: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

export async function getWarehouseLocations(input: { warehouseId?: string }) {
  const { organization } = await requireModuleAccess("warehouse")
  await ensureWarehouseLocationSchema()

  const warehouseId = normalizeText(input.warehouseId)

  const whereWarehouseClause = warehouseId ? ` AND "warehouseId" = $2` : ""
  const params = warehouseId ? [organization.id, warehouseId] : [organization.id]

  const [zones, aisles, racks, bins] = await Promise.all([
    prisma.$queryRawUnsafe<WarehouseZoneRow[]>(
      `SELECT * FROM "WarehouseZone" WHERE "organizationId" = $1${whereWarehouseClause} ORDER BY "code" ASC`,
      ...params,
    ),
    prisma.$queryRawUnsafe<WarehouseAisleRow[]>(
      `SELECT * FROM "WarehouseAisle" WHERE "organizationId" = $1${whereWarehouseClause} ORDER BY "code" ASC`,
      ...params,
    ),
    prisma.$queryRawUnsafe<WarehouseRackRow[]>(
      `SELECT * FROM "WarehouseRack" WHERE "organizationId" = $1${whereWarehouseClause} ORDER BY "code" ASC`,
      ...params,
    ),
    prisma.$queryRawUnsafe<WarehouseBinRow[]>(
      `SELECT * FROM "WarehouseBin" WHERE "organizationId" = $1${whereWarehouseClause} ORDER BY "code" ASC`,
      ...params,
    ),
  ])

  return { zones, aisles, racks, bins }
}

async function getNextTransferOrderCode(tx: Prisma.TransactionClient, organizationId: string) {
  await ensureWarehouseTransferSchema()
  const year = new Date().getFullYear()
  const prefix = `TO-${year}-`

  const rows = await tx.$queryRawUnsafe<Array<{ code: string }>>(
    `SELECT "code" FROM "TransferOrder" WHERE "organizationId" = $1 AND "code" LIKE $2 ORDER BY "code" DESC LIMIT 1`,
    organizationId,
    `${prefix}%`,
  )

  const latest = rows[0]?.code
  const latestSeq = latest ? Number.parseInt(latest.split("-")[2] || "0", 10) : 0
  return `${prefix}${String(latestSeq + 1).padStart(4, "0")}`
}

export async function createTransferOrderAndPost(input: {
  fromWarehouseId: string
  toWarehouseId: string
  fromItemId: string
  quantity: number
  notes?: string
}) {
  const { organization, user } = await requireWritableModuleAccess("warehouse")
  await ensureWarehouseTransferSchema()

  const fromWarehouseId = normalizeText(input.fromWarehouseId)
  const toWarehouseId = normalizeText(input.toWarehouseId)
  const fromItemId = normalizeText(input.fromItemId)
  const quantity = Number(input.quantity || 0)

  if (!fromWarehouseId || !toWarehouseId || !fromItemId) throw new Error("Data transfer tidak lengkap.")
  if (fromWarehouseId === toWarehouseId) throw new Error("Gudang asal dan tujuan tidak boleh sama.")
  if (quantity <= 0) throw new Error("Qty transfer harus lebih dari 0.")

  const result = await prisma.$transaction(async (tx) => {
    const fromItem = await tx.inventoryItem.findFirst({
      where: { id: fromItemId, organizationId: organization.id, warehouseId: fromWarehouseId },
      select: {
        id: true,
        code: true,
        barcode: true,
        name: true,
        description: true,
        category: true,
        unit: true,
        valuationMethod: true,
        unitCost: true,
        totalValue: true,
        quantity: true,
        status: true,
      },
    })

    if (!fromItem) throw new Error("Item asal tidak ditemukan atau bukan milik warehouse aktif.")

    // Ensure destination item exists (per-warehouse SKU).
    let toItem = await tx.inventoryItem.findFirst({
      where: { organizationId: organization.id, warehouseId: toWarehouseId, code: fromItem.code },
      select: { id: true, code: true, name: true, unit: true, unitCost: true, totalValue: true, quantity: true },
    })

    if (!toItem) {
      toItem = await tx.inventoryItem.create({
        data: {
          organizationId: organization.id,
          warehouseId: toWarehouseId,
          code: fromItem.code,
          barcode: fromItem.barcode,
          name: fromItem.name,
          description: fromItem.description,
          category: fromItem.category,
          unit: fromItem.unit,
          valuationMethod: fromItem.valuationMethod,
          quantity: 0,
          unitCost: fromItem.unitCost || 0,
          totalValue: 0,
          status: "ACTIVE",
        },
        select: { id: true, code: true, name: true, unit: true, unitCost: true, totalValue: true, quantity: true },
      })
    }

    const code = await getNextTransferOrderCode(tx, organization.id)
    const transferOrder = await tx.$queryRawUnsafe<Array<{ id: string }>>(
      `
        INSERT INTO "TransferOrder" ("organizationId", "code", "status", "fromWarehouseId", "toWarehouseId", "notes", "createdBy")
        VALUES ($1, $2, 'POSTED', $3, $4, $5, $6)
        RETURNING "id"
      `,
      organization.id,
      code,
      fromWarehouseId,
      toWarehouseId,
      input.notes ?? null,
      user.id,
    )

    const transferId = transferOrder[0]?.id
    if (!transferId) throw new Error("Gagal membuat transfer order.")

    const unitCost = Number(fromItem.unitCost || 0)
    const descriptionBase = `Transfer ${code} ${fromItem.code} qty ${quantity} ${fromItem.unit} dari WH:${fromWarehouseId} ke WH:${toWarehouseId}`

    const movementOut = await postInventoryMovementInTx(tx, {
      organizationId: organization.id,
      itemId: fromItem.id,
      movementType: "OUT",
      quantity,
      unitCost,
      reference: code,
      description: `${descriptionBase} (OUT)`,
      toWarehouseId: toWarehouseId,
      performedBy: user.id,
      idempotencyKey: `${transferId}:OUT`,
    })

    const movementIn = await postInventoryMovementInTx(tx, {
      organizationId: organization.id,
      itemId: toItem.id,
      movementType: "IN",
      quantity,
      unitCost,
      reference: code,
      description: `${descriptionBase} (IN)`,
      performedBy: user.id,
      idempotencyKey: `${transferId}:IN`,
    })

    await tx.$executeRawUnsafe(
      `
        UPDATE "TransferOrder"
        SET "movementOutId" = $1,
            "movementInId" = $2,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $3 AND "organizationId" = $4
      `,
      movementOut.id,
      movementIn.id,
      transferId,
      organization.id,
    )

    await tx.$executeRawUnsafe(
      `
        INSERT INTO "TransferOrderLine" ("transferOrderId", "fromItemId", "toItemId", "quantity", "unitCost", "notes")
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      transferId,
      fromItem.id,
      toItem.id,
      quantity,
      unitCost,
      input.notes ?? null,
    )

    return { code, transferId, movementOutId: movementOut.id, movementInId: movementIn.id }
  })

  return { success: true, ...result }
}

export async function createWarehouseZone(input: { warehouseId: string; code: string; name: string; notes?: string }) {
  const { organization } = await requireWritableModuleAccess("warehouse")
  await ensureWarehouseLocationSchema()

  const warehouseId = normalizeText(input.warehouseId)
  const code = normalizeText(input.code)
  const name = normalizeText(input.name)
  if (!warehouseId || !code || !name) throw new Error("warehouseId/code/name wajib diisi")

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "WarehouseZone" ("organizationId", "warehouseId", "code", "name", "notes")
      VALUES ($1, $2, $3, $4, $5)
    `,
    organization.id,
    warehouseId,
    code,
    name,
    input.notes ?? null,
  )

  return { success: true }
}

export async function createWarehouseAisle(input: {
  warehouseId: string
  zoneId?: string | null
  code: string
  name: string
  notes?: string
}) {
  const { organization } = await requireWritableModuleAccess("warehouse")
  await ensureWarehouseLocationSchema()

  const warehouseId = normalizeText(input.warehouseId)
  const code = normalizeText(input.code)
  const name = normalizeText(input.name)
  if (!warehouseId || !code || !name) throw new Error("warehouseId/code/name wajib diisi")

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "WarehouseAisle" ("organizationId", "warehouseId", "zoneId", "code", "name", "notes")
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    organization.id,
    warehouseId,
    input.zoneId ?? null,
    code,
    name,
    input.notes ?? null,
  )

  return { success: true }
}

export async function createWarehouseRack(input: {
  warehouseId: string
  aisleId?: string | null
  code: string
  name: string
  notes?: string
}) {
  const { organization } = await requireWritableModuleAccess("warehouse")
  await ensureWarehouseLocationSchema()

  const warehouseId = normalizeText(input.warehouseId)
  const code = normalizeText(input.code)
  const name = normalizeText(input.name)
  if (!warehouseId || !code || !name) throw new Error("warehouseId/code/name wajib diisi")

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "WarehouseRack" ("organizationId", "warehouseId", "aisleId", "code", "name", "notes")
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    organization.id,
    warehouseId,
    input.aisleId ?? null,
    code,
    name,
    input.notes ?? null,
  )

  return { success: true }
}

export async function createWarehouseBin(input: {
  warehouseId: string
  rackId?: string | null
  code: string
  name: string
  barcode?: string
  notes?: string
}) {
  const { organization } = await requireWritableModuleAccess("warehouse")
  await ensureWarehouseLocationSchema()

  const warehouseId = normalizeText(input.warehouseId)
  const code = normalizeText(input.code)
  const name = normalizeText(input.name)
  if (!warehouseId || !code || !name) throw new Error("warehouseId/code/name wajib diisi")

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "WarehouseBin" ("organizationId", "warehouseId", "rackId", "code", "name", "barcode", "notes")
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    organization.id,
    warehouseId,
    input.rackId ?? null,
    code,
    name,
    input.barcode ?? null,
    input.notes ?? null,
  )

  return { success: true }
}

export async function deleteWarehouseLocation(input: { table: "WarehouseZone" | "WarehouseAisle" | "WarehouseRack" | "WarehouseBin"; id: string }) {
  const { organization } = await requireWritableModuleAccess("warehouse")
  await ensureWarehouseLocationSchema()

  const id = normalizeText(input.id)
  if (!id) throw new Error("id wajib diisi")

  // Keep it explicitly whitelisted to avoid SQL injection.
  const table = input.table
  if (!["WarehouseZone", "WarehouseAisle", "WarehouseRack", "WarehouseBin"].includes(table)) {
    throw new Error("table tidak valid")
  }

  await prisma.$executeRawUnsafe(`DELETE FROM "${table}" WHERE "id" = $1 AND "organizationId" = $2`, id, organization.id)
  return { success: true }
}

export async function assignInventoryItemBin(input: {
  itemId: string
  warehouseId: string
  zoneCode?: string
  aisleCode?: string
  rackCode?: string
  binCode?: string
}) {
  const { organization } = await requireWritableModuleAccess("warehouse")

  const itemId = normalizeText(input.itemId)
  const warehouseId = normalizeText(input.warehouseId)
  if (!itemId || !warehouseId) throw new Error("itemId/warehouseId wajib diisi")

  // Backward-compatible mapping: keep using flat fields on InventoryItem.
  const updated = await prisma.inventoryItem.updateMany({
    where: { id: itemId, organizationId: organization.id, warehouseId },
    data: {
      shelf: input.zoneCode?.trim() || null,
      row: input.aisleCode?.trim() || null,
      level: input.rackCode?.trim() || null,
      bin: input.binCode?.trim() || null,
    },
  })

  if (updated.count === 0) {
    throw new Error("Item tidak ditemukan atau bukan milik organisasi/warehouse aktif")
  }

  return { success: true }
}

// Re-export some inventory inputs so UI warehouse bisa "tab input lengkap"
export async function createWarehouseInventoryItem(data: Parameters<typeof createInventoryItem>[0]) {
  return createInventoryItem(data)
}

export async function createWarehouseInventoryMovement(data: Parameters<typeof createInventoryMovement>[0]) {
  return createInventoryMovement(data)
}

export async function createWarehouseStockOpname(data: Parameters<typeof createStockOpname>[0]) {
  return createStockOpname(data)
}

export async function getWarehouseInventoryItems(organizationId: string, warehouseId?: string) {
  return getInventoryItems(organizationId, warehouseId)
}

export async function getWarehouseStockOpnames(organizationId: string) {
  return getStockOpnames(organizationId)
}
