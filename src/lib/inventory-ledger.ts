import type { Prisma } from "@prisma/client"
import { createHash } from "node:crypto"
import { ensureInventorySecuritySchema } from "@/lib/inventory-security-schema"
import { ensureCostLayerSchema } from "@/lib/cost-layer-schema"
import { enqueueOutboxEventInTx } from "@/lib/outbox"
import { ensureStockBalanceSchema } from "@/lib/stock-balance-schema"
import { postStockAdjustmentJournalInTx } from "@/lib/inventory-accounting"

export type InventoryMovementType = "IN" | "OUT" | "ADJUSTMENT" | "TRANSFER"

export type PostInventoryMovementInput = {
  organizationId: string
  itemId: string
  movementType: InventoryMovementType
  quantity: number
  unitCost?: number
  reference?: string
  description?: string
  fromWarehouseId?: string
  toWarehouseId?: string
  fromBinId?: string
  toBinId?: string
  lotBatchId?: string
  performedBy: string
  idempotencyKey?: string
}

function buildMovementRequestHash(data: {
  organizationId: string
  itemId: string
  movementType: InventoryMovementType
  quantity: number
  unitCost?: number
  reference?: string
  description?: string
  fromWarehouseId?: string
  toWarehouseId?: string
  fromBinId?: string
  toBinId?: string
  lotBatchId?: string
}) {
  const payload = [
    data.organizationId,
    data.itemId,
    data.movementType,
    String(data.quantity),
    String(data.unitCost ?? ""),
    data.reference ?? "",
    data.description ?? "",
    data.fromWarehouseId ?? "",
    data.toWarehouseId ?? "",
    data.fromBinId ?? "",
    data.toBinId ?? "",
    data.lotBatchId ?? "",
  ].join("|")

  return createHash("sha256").update(payload).digest("hex")
}

async function ensureBinBelongsToWarehouseOrThrow(
  tx: Prisma.TransactionClient,
  input: { organizationId: string; warehouseId: string; binId: string; label: "fromBinId" | "toBinId" },
) {
  const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
    `
      SELECT "id"
      FROM "WarehouseBin"
      WHERE "id" = $1 AND "organizationId" = $2 AND "warehouseId" = $3
      LIMIT 1
    `,
    input.binId,
    input.organizationId,
    input.warehouseId,
  )
  if (!rows[0]?.id) {
    throw new Error(`${input.label} tidak valid atau bukan milik warehouse aktif`)
  }
}

async function lockOrInitStockBalanceRow(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string
    itemId: string
    warehouseId: string
    binId?: string | null
    lotBatchId?: string | null
  },
) {
  await ensureStockBalanceSchema()

  // Ensure row exists (unique index allows NULLs, so we coalesce NULLs into a stable key by storing NULLs but selecting by IS NOT DISTINCT FROM).
  await tx.$executeRawUnsafe(
    `
      INSERT INTO "StockBalance" ("organizationId", "itemId", "warehouseId", "binId", "lotBatchId", "quantity")
      VALUES ($1, $2, $3, $4, $5, 0)
      ON CONFLICT DO NOTHING
    `,
    input.organizationId,
    input.itemId,
    input.warehouseId,
    input.binId ?? null,
    input.lotBatchId ?? null,
  )

  const rows = await tx.$queryRawUnsafe<Array<{ id: string; quantity: number }>>(
    `
      SELECT "id", "quantity"
      FROM "StockBalance"
      WHERE "organizationId" = $1
        AND "itemId" = $2
        AND "binId" IS NOT DISTINCT FROM $3
        AND "lotBatchId" IS NOT DISTINCT FROM $4
      LIMIT 1
      FOR UPDATE
    `,
    input.organizationId,
    input.itemId,
    input.binId ?? null,
    input.lotBatchId ?? null,
  )
  return rows[0] ?? null
}

async function applyStockBalanceDeltaOrThrow(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string
    itemId: string
    warehouseId: string
    binId?: string | null
    lotBatchId?: string | null
    delta: number
    allowNegative?: boolean
  },
) {
  if (!input.binId && !input.lotBatchId) {
    // No bin/lot context => nothing to do for enterprise bin-balance.
    return
  }

  const locked = await lockOrInitStockBalanceRow(tx, input)
  if (!locked) throw new Error("Gagal mengunci StockBalance")

  const nextQty = Number(locked.quantity || 0) + Number(input.delta || 0)
  if (!input.allowNegative && nextQty < 0) {
    throw new Error(`Stok bin/lot tidak cukup. Tersedia: ${locked.quantity}, delta: ${input.delta}`)
  }

  await tx.$executeRawUnsafe(
    `
      UPDATE "StockBalance"
      SET "quantity" = $1,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = $2 AND "organizationId" = $3
    `,
    nextQty,
    locked.id,
    input.organizationId,
  )
}

async function lockInventoryItemOrThrow(
  tx: Prisma.TransactionClient,
  input: { organizationId: string; itemId: string },
) {
  const rows = await tx.$queryRawUnsafe<
    Array<{
      id: string
      warehouseId: string
      quantity: number
      totalValue: number
      unitCost: number
      valuationMethod: string
    }>
  >(
    `
      SELECT "id", "warehouseId", "quantity", "totalValue", "unitCost", "valuationMethod"
      FROM "InventoryItem"
      WHERE "id" = $1 AND "organizationId" = $2
      FOR UPDATE
    `,
    input.itemId,
    input.organizationId,
  )

  const locked = rows[0]
  if (!locked) {
    throw new Error("Inventory item not found")
  }
  return locked
}

async function lockCostLayersForItem(
  tx: Prisma.TransactionClient,
  input: { organizationId: string; itemId: string; order: "FIFO" | "LIFO" },
) {
  await ensureCostLayerSchema()
  const layers = await tx.$queryRawUnsafe<
    Array<{
      id: string
      remainingQty: number
      unitCost: number
      createdAt: Date
    }>
  >(
    `
      SELECT "id", "remainingQty", "unitCost", "createdAt"
      FROM "CostLayer"
      WHERE "organizationId" = $1
        AND "itemId" = $2
        AND "remainingQty" > 0
      ORDER BY "createdAt" ${input.order === "LIFO" ? "DESC" : "ASC"}
      FOR UPDATE
    `,
    input.organizationId,
    input.itemId,
  )
  return layers
}

async function consumeCostLayers(
  tx: Prisma.TransactionClient,
  input: { organizationId: string; itemId: string; quantity: number; method: "FIFO" | "LIFO" },
) {
  let remainingToConsume = input.quantity
  let totalCost = 0

  const layers = await lockCostLayersForItem(tx, {
    organizationId: input.organizationId,
    itemId: input.itemId,
    order: input.method,
  })
  for (const layer of layers) {
    if (remainingToConsume <= 0) break
    const takeQty = Math.min(remainingToConsume, Number(layer.remainingQty || 0))
    if (takeQty <= 0) continue

    const nextRemainingQty = Number(layer.remainingQty) - takeQty
    await tx.$executeRawUnsafe(
      `UPDATE "CostLayer" SET "remainingQty" = $1 WHERE "id" = $2 AND "organizationId" = $3`,
      nextRemainingQty,
      layer.id,
      input.organizationId,
    )

    totalCost += takeQty * Number(layer.unitCost || 0)
    remainingToConsume -= takeQty
  }

  if (remainingToConsume > 0) {
    throw new Error(`Cost layer ${input.method} tidak cukup untuk memenuhi OUT.`)
  }

  return { totalCost }
}

async function initIdempotencyIfNeeded(
  tx: Prisma.TransactionClient,
  input: PostInventoryMovementInput,
  requestHash: string,
) {
  if (!input.idempotencyKey) return null

  await ensureInventorySecuritySchema()

  await tx.$executeRawUnsafe(
    `
      INSERT INTO "InventoryMovementIdempotency"
        ("organizationId", "idempotencyKey", "requestHash", "status")
      VALUES ($1, $2, $3, 'PENDING')
      ON CONFLICT ("organizationId", "idempotencyKey") DO NOTHING
    `,
    input.organizationId,
    input.idempotencyKey,
    requestHash,
  )

  const idemRows = await tx.$queryRawUnsafe<
    Array<{
      requestHash: string
      status: string
      movementId: string | null
    }>
  >(
    `
      SELECT "requestHash", "status", "movementId"
      FROM "InventoryMovementIdempotency"
      WHERE "organizationId" = $1 AND "idempotencyKey" = $2
      LIMIT 1
    `,
    input.organizationId,
    input.idempotencyKey,
  )

  const idem = idemRows[0]
  if (!idem) {
    throw new Error("Gagal menginisialisasi idempotency request")
  }
  if (idem.requestHash !== requestHash) {
    throw new Error("Idempotency key sudah dipakai untuk payload berbeda")
  }

  return idem
}

async function completeIdempotencyIfNeeded(
  tx: Prisma.TransactionClient,
  input: PostInventoryMovementInput,
  movementId: string,
) {
  if (!input.idempotencyKey) return

  await tx.$executeRawUnsafe(
    `
      UPDATE "InventoryMovementIdempotency"
      SET "status" = 'COMPLETED',
          "movementId" = $1,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "organizationId" = $2
        AND "idempotencyKey" = $3
    `,
    movementId,
    input.organizationId,
    input.idempotencyKey,
  )
}

export async function postInventoryMovementInTx(
  tx: Prisma.TransactionClient,
  input: PostInventoryMovementInput,
) {
  const quantity = Number(input.quantity || 0)
  if (quantity <= 0) {
    throw new Error("Quantity harus lebih dari 0")
  }

  if (input.movementType === "TRANSFER" && (!input.fromWarehouseId || !input.toWarehouseId)) {
    throw new Error("Transfer wajib memiliki fromWarehouseId dan toWarehouseId")
  }

  // Keep backward compatibility: ADJUSTMENT means "set to this quantity".
  if (input.movementType === "ADJUSTMENT") {
    const targetQty = quantity
    return await adjustInventoryItemToQuantityInTx(tx, {
      organizationId: input.organizationId,
      itemId: input.itemId,
      targetQuantity: targetQty,
      unitCost: input.unitCost,
      reference: input.reference,
      description: input.description,
      performedBy: input.performedBy,
      idempotencyKey: input.idempotencyKey,
    })
  }

  const requestHash = input.idempotencyKey ? buildMovementRequestHash({ ...input, quantity }) : ""

  const idem = await initIdempotencyIfNeeded(tx, input, requestHash)
  if (idem?.status === "COMPLETED" && idem.movementId) {
    const existing = await tx.inventoryMovement.findFirst({
      where: { id: idem.movementId, organizationId: input.organizationId },
    })
    if (existing) return existing
  }

  const locked = await lockInventoryItemOrThrow(tx, { organizationId: input.organizationId, itemId: input.itemId })

  if (input.fromWarehouseId && input.fromWarehouseId !== locked.warehouseId) {
    throw new Error("fromWarehouseId tidak sesuai dengan warehouse item")
  }

  if (input.fromBinId) {
    await ensureBinBelongsToWarehouseOrThrow(tx, {
      organizationId: input.organizationId,
      warehouseId: locked.warehouseId,
      binId: input.fromBinId,
      label: "fromBinId",
    })
  }
  if (input.toBinId) {
    await ensureBinBelongsToWarehouseOrThrow(tx, {
      organizationId: input.organizationId,
      warehouseId: locked.warehouseId,
      binId: input.toBinId,
      label: "toBinId",
    })
  }

  const valuationMethod = String(locked.valuationMethod || "AVERAGE").toUpperCase()
  let unitCost = Number(input.unitCost ?? locked.unitCost ?? 0)
  let totalCost = quantity * unitCost
  if (valuationMethod === "STANDARD") {
    unitCost = Number(locked.unitCost || 0)
    totalCost = quantity * unitCost
  }

  if (input.movementType === "IN") {
    const nextQty = locked.quantity + quantity
    const nextTotalValue = locked.totalValue + totalCost

    if (valuationMethod === "AVERAGE" && nextQty > 0) {
      const nextUnitCost = nextTotalValue / nextQty
      await tx.inventoryItem.update({
        where: { id: input.itemId },
        data: { quantity: nextQty, totalValue: nextTotalValue, unitCost: nextUnitCost },
      })
    } else if (valuationMethod === "STANDARD") {
      await tx.inventoryItem.update({
        where: { id: input.itemId },
        data: {
          quantity: nextQty,
          totalValue: nextQty * unitCost,
        },
      })
    } else {
      await tx.inventoryItem.update({
        where: { id: input.itemId },
        data: {
          quantity: nextQty,
          totalValue: nextTotalValue,
          ...(input.unitCost !== undefined ? { unitCost } : {}),
        },
      })
    }

    await applyStockBalanceDeltaOrThrow(tx, {
      organizationId: input.organizationId,
      itemId: input.itemId,
      warehouseId: locked.warehouseId,
      binId: input.toBinId ?? null,
      lotBatchId: input.lotBatchId ?? null,
      delta: quantity,
    })
  } else if (input.movementType === "OUT" || input.movementType === "TRANSFER") {
    if (locked.quantity < quantity) {
      throw new Error(`Stok tidak cukup. Stok tersedia: ${locked.quantity}, diminta: ${quantity}`)
    }
    if (valuationMethod === "FIFO" || valuationMethod === "LIFO") {
      const layers = await consumeCostLayers(tx, {
        organizationId: input.organizationId,
        itemId: input.itemId,
        quantity,
        method: valuationMethod,
      })
      totalCost = layers.totalCost
      unitCost = quantity > 0 ? totalCost / quantity : unitCost
    }
    const nextQty = locked.quantity - quantity
    const nextTotalValue = Math.max(0, locked.totalValue - totalCost)
    await tx.inventoryItem.update({
      where: { id: input.itemId },
      data: { quantity: nextQty, totalValue: nextTotalValue },
    })

    await applyStockBalanceDeltaOrThrow(tx, {
      organizationId: input.organizationId,
      itemId: input.itemId,
      warehouseId: locked.warehouseId,
      binId: input.fromBinId ?? null,
      lotBatchId: input.lotBatchId ?? null,
      delta: -quantity,
    })
  } else {
    throw new Error("Movement type tidak didukung")
  }

  const movement = await tx.inventoryMovement.create({
    data: {
      organizationId: input.organizationId,
      itemId: input.itemId,
      movementType: input.movementType,
      quantity,
      unitCost,
      totalCost,
      reference: input.reference,
      description: input.description,
      fromWarehouseId: input.fromWarehouseId,
      toWarehouseId: input.toWarehouseId,
      performedBy: input.performedBy,
    },
  })

  // Evidence for enterprise bin/lot traceability (optional).
  if (input.fromBinId || input.toBinId || input.lotBatchId) {
    await tx.$executeRawUnsafe(
      `
        INSERT INTO "InventoryMovementEvidence"
          ("organizationId", "movementId", "fromBinId", "toBinId", "lotBatchId")
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT ("organizationId", "movementId") DO NOTHING
      `,
      input.organizationId,
      movement.id,
      input.fromBinId ?? null,
      input.toBinId ?? null,
      input.lotBatchId ?? null,
    )
  }

  await enqueueOutboxEventInTx(tx, {
    organizationId: input.organizationId,
    aggregateType: "InventoryMovement",
    aggregateId: movement.id,
    eventType: "inventory.movement.posted",
    schemaVersion: 1,
    payload: { movementId: movement.id },
    dedupeKey: movement.id,
  })

  if ((valuationMethod === "FIFO" || valuationMethod === "LIFO") && input.movementType === "IN") {
    await ensureCostLayerSchema()
    await tx.$executeRawUnsafe(
      `
        INSERT INTO "CostLayer" ("organizationId", "itemId", "movementInId", "receivedQty", "remainingQty", "unitCost")
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      input.organizationId,
      input.itemId,
      movement.id,
      quantity,
      quantity,
      unitCost,
    )
  }

  await completeIdempotencyIfNeeded(tx, input, movement.id)
  return movement
}

export async function adjustInventoryItemToQuantityInTx(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string
    itemId: string
    targetQuantity: number
    unitCost?: number
    reference?: string
    description?: string
    performedBy: string
    idempotencyKey?: string
    expectedWarehouseId?: string
    binId?: string
    lotBatchId?: string
  },
) {
  const targetQuantity = Number(input.targetQuantity)
  if (Number.isNaN(targetQuantity) || targetQuantity < 0) {
    throw new Error("Target quantity tidak valid")
  }

  const requestHash = input.idempotencyKey
    ? buildMovementRequestHash({
        organizationId: input.organizationId,
        itemId: input.itemId,
        movementType: "ADJUSTMENT",
        quantity: targetQuantity,
        unitCost: input.unitCost,
        reference: input.reference,
        description: input.description,
        fromWarehouseId: "",
        toWarehouseId: "",
      })
    : ""

  const idem = input.idempotencyKey
    ? await initIdempotencyIfNeeded(
        tx,
        {
          organizationId: input.organizationId,
          itemId: input.itemId,
          movementType: "ADJUSTMENT",
          quantity: targetQuantity,
          unitCost: input.unitCost,
          reference: input.reference,
          description: input.description,
          performedBy: input.performedBy,
          idempotencyKey: input.idempotencyKey,
        },
        requestHash,
      )
    : null

  if (idem?.status === "COMPLETED" && idem.movementId) {
    const existing = await tx.inventoryMovement.findFirst({
      where: { id: idem.movementId, organizationId: input.organizationId },
    })
    if (existing) return existing
  }

  const locked = await lockInventoryItemOrThrow(tx, { organizationId: input.organizationId, itemId: input.itemId })
  if (input.expectedWarehouseId && locked.warehouseId !== input.expectedWarehouseId) {
    throw new Error("Item tidak berada di warehouse stock opname")
  }

  if (input.binId) {
    await ensureBinBelongsToWarehouseOrThrow(tx, {
      organizationId: input.organizationId,
      warehouseId: locked.warehouseId,
      binId: input.binId,
      label: "toBinId",
    })
  }

  const delta = targetQuantity - locked.quantity
  if (delta === 0) {
    // Still record a zero-change adjustment? For now, skip and return a synthetic error-friendly response.
    throw new Error("Tidak ada selisih quantity untuk disesuaikan")
  }

  const valuationMethod = String(locked.valuationMethod || "AVERAGE")
  let unitCost = Number(input.unitCost ?? locked.unitCost ?? 0)
  const movementQty = Math.abs(delta)
  let totalCost = movementQty * unitCost

  const upperMethod = String(valuationMethod || "AVERAGE").toUpperCase()
  if (upperMethod === "STANDARD") {
    unitCost = Number(locked.unitCost || 0)
    totalCost = movementQty * unitCost
  } else if (upperMethod === "FIFO" || upperMethod === "LIFO") {
    if (delta < 0) {
      const layers = await consumeCostLayers(tx, {
        organizationId: input.organizationId,
        itemId: input.itemId,
        quantity: movementQty,
        method: upperMethod,
      })
      totalCost = layers.totalCost
      unitCost = movementQty > 0 ? totalCost / movementQty : unitCost
    } else {
      await ensureCostLayerSchema()
      await tx.$executeRawUnsafe(
        `
          INSERT INTO "CostLayer" ("organizationId", "itemId", "receivedQty", "remainingQty", "unitCost")
          VALUES ($1, $2, $3, $4, $5)
        `,
        input.organizationId,
        input.itemId,
        movementQty,
        movementQty,
        unitCost,
      )
      totalCost = movementQty * unitCost
    }
  }

  await tx.inventoryItem.update({
    where: { id: input.itemId },
    data: {
      quantity: targetQuantity,
      totalValue:
        upperMethod === "FIFO" || upperMethod === "LIFO"
          ? Math.max(0, locked.totalValue + (delta < 0 ? -totalCost : totalCost))
          : targetQuantity * unitCost,
      ...(upperMethod === "STANDARD" ? {} : input.unitCost !== undefined ? { unitCost } : {}),
    },
  })

  // Adjustment: apply delta to a specific bin/lot if specified, else skip (warehouse-level adjustment remains).
  await applyStockBalanceDeltaOrThrow(tx, {
    organizationId: input.organizationId,
    itemId: input.itemId,
    warehouseId: locked.warehouseId,
    binId: input.binId ?? null,
    lotBatchId: input.lotBatchId ?? null,
    delta,
  })

  const movement = await tx.inventoryMovement.create({
    data: {
      organizationId: input.organizationId,
      itemId: input.itemId,
      movementType: "ADJUSTMENT",
      quantity: movementQty,
      unitCost,
      totalCost,
      reference: input.reference,
      description:
        input.description ??
        `Stock adjustment set qty from ${locked.quantity} to ${targetQuantity} (delta ${delta > 0 ? "+" : "-"}${movementQty})`,
      performedBy: input.performedBy,
    },
  })

  await postStockAdjustmentJournalInTx(tx, {
    organizationId: input.organizationId,
    movementId: movement.id,
    amount: totalCost,
    direction: delta > 0 ? "INCREASE" : "DECREASE",
    reference: input.reference,
  })

  if (input.binId || input.lotBatchId) {
    await tx.$executeRawUnsafe(
      `
        INSERT INTO "InventoryMovementEvidence"
          ("organizationId", "movementId", "toBinId", "lotBatchId")
        VALUES ($1, $2, $3, $4)
        ON CONFLICT ("organizationId", "movementId") DO NOTHING
      `,
      input.organizationId,
      movement.id,
      input.binId ?? null,
      input.lotBatchId ?? null,
    )
  }

  await enqueueOutboxEventInTx(tx, {
    organizationId: input.organizationId,
    aggregateType: "InventoryMovement",
    aggregateId: movement.id,
    eventType: "inventory.movement.posted",
    schemaVersion: 1,
    payload: { movementId: movement.id },
    dedupeKey: movement.id,
  })

  if (input.idempotencyKey) {
    await completeIdempotencyIfNeeded(
      tx,
      {
        organizationId: input.organizationId,
        itemId: input.itemId,
        movementType: "ADJUSTMENT",
        quantity: targetQuantity,
        unitCost: input.unitCost,
        reference: input.reference,
        description: input.description,
        performedBy: input.performedBy,
        idempotencyKey: input.idempotencyKey,
      },
      movement.id,
    )
  }

  return movement
}
