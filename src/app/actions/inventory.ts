"use server"

import { prisma } from "@/lib/prisma"
import { requireCurrentOrganization, requireWritableCurrentOrganization } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import type { Prisma } from "@prisma/client"
import { postInventoryMovementInTx, adjustInventoryItemToQuantityInTx } from "@/lib/inventory-ledger"

export async function getInventoryItems(organizationId: string, warehouseId?: string) {
  const { organization } = await requireCurrentOrganization()
  if (!organization || organization.id !== organizationId) {
    throw new Error("Unauthorized")
  }

  const where: Prisma.InventoryItemWhereInput = { organizationId }
  if (warehouseId) {
    where.warehouseId = warehouseId
  }

  const items = await prisma.inventoryItem.findMany({
    where,
    include: {
      warehouse: {
        select: { id: true, code: true, name: true }
      }
    },
    orderBy: { code: 'asc' }
  })

  return items
}

export async function getWarehouses(organizationId: string) {
  const { organization } = await requireCurrentOrganization()
  if (!organization || organization.id !== organizationId) {
    throw new Error("Unauthorized")
  }

  return await prisma.warehouse.findMany({
    where: { organizationId, status: "ACTIVE" },
    orderBy: { name: "asc" }
  })
}

export async function getInventoryMovements(organizationId: string) {
  const { organization } = await requireCurrentOrganization()
  if (!organization || organization.id !== organizationId) {
    throw new Error("Unauthorized")
  }

  const movements = await prisma.inventoryMovement.findMany({
    where: { organizationId },
    include: {
      item: {
        select: {
          id: true,
          code: true,
          barcode: true,
          name: true,
          unit: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  })

  return movements
}

export async function createInventoryItem(data: {
  organizationId: string
  warehouseId: string
  code: string
  barcode?: string
  name: string
  description?: string
  category?: string
  unit: string
  valuationMethod?: string
  quantity?: number
  minStock?: number
  maxStock?: number
  unitCost?: number
}) {
  const { organization } = await requireWritableCurrentOrganization()
  if (!organization || organization.id !== data.organizationId) {
    throw new Error("Unauthorized")
  }

  const quantity = data.quantity || 0
  const unitCost = data.unitCost || 0
  const totalValue = quantity * unitCost

  const item = await prisma.inventoryItem.create({
    data: {
      organizationId: data.organizationId,
      warehouseId: data.warehouseId,
      code: data.code,
      barcode: data.barcode,
      name: data.name,
      description: data.description,
      category: data.category,
      unit: data.unit,
      valuationMethod: data.valuationMethod || "AVERAGE",
      quantity,
      minStock: data.minStock || 0,
      maxStock: data.maxStock,
      unitCost,
      totalValue
    }
  })

  revalidatePath("/inventory")
  return item
}

export async function updateInventoryItem(id: string, data: {
  organizationId: string
  code?: string
  barcode?: string
  name?: string
  unit?: string
  unitCost?: number
  warehouseId?: string
}) {
  const { organization } = await requireWritableCurrentOrganization()
  if (!organization || organization.id !== data.organizationId) {
    throw new Error("Unauthorized")
  }

  const item = await prisma.inventoryItem.update({
    where: { id, organizationId: data.organizationId },
    data: {
      ...(data.code && { code: data.code }),
      ...(data.barcode !== undefined && { barcode: data.barcode }),
      ...(data.name && { name: data.name }),
      ...(data.unit && { unit: data.unit }),
      ...(data.unitCost !== undefined && { unitCost: data.unitCost }),
      ...(data.warehouseId && { warehouseId: data.warehouseId }),
    }
  })

  revalidatePath("/inventory")
  return item
}

export async function deleteInventoryItem(id: string, organizationId: string) {
  const { organization } = await requireWritableCurrentOrganization()
  if (!organization || organization.id !== organizationId) {
    throw new Error("Unauthorized")
  }

  // Validasi: Tolak penghapusan jika barang sudah ada histori pergerakan stok
  const movementCount = await prisma.inventoryMovement.count({
    where: { itemId: id, organizationId }
  })

  if (movementCount > 0) {
    throw new Error("Gagal menghapus: Barang ini sudah memiliki histori pergerakan stok.")
  }

  await prisma.inventoryItem.delete({
    where: { id, organizationId }
  })

  revalidatePath("/inventory")
  return { success: true }
}

export async function createInventoryMovement(data: {
  organizationId: string
  itemId: string
  movementType: "IN" | "OUT" | "ADJUSTMENT" | "TRANSFER"
  quantity: number
  unitCost?: number
  reference?: string
  description?: string
  fromWarehouseId?: string
  toWarehouseId?: string
  idempotencyKey?: string
}) {
  const { user, organization } = await requireWritableCurrentOrganization()
  if (!user?.id || !organization || organization.id !== data.organizationId) {
    throw new Error("Unauthorized")
  }

  if (data.movementType === "ADJUSTMENT" && !["ADMIN", "MANAGER"].includes(user.role)) {
    throw new Error("Mutasi ADJUSTMENT memerlukan approval MANAGER/ADMIN.")
  }

  const quantity = Number(data.quantity || 0)
  if (quantity <= 0) {
    throw new Error("Quantity harus lebih dari 0")
  }

  if (data.movementType === "TRANSFER" && (!data.fromWarehouseId || !data.toWarehouseId)) {
    throw new Error("Transfer wajib memiliki fromWarehouseId dan toWarehouseId")
  }

  const movement = await prisma.$transaction(async (tx) => {
    return await postInventoryMovementInTx(tx, {
      organizationId: data.organizationId,
      itemId: data.itemId,
      movementType: data.movementType,
      quantity,
      unitCost: data.unitCost,
      reference: data.reference,
      description: data.description,
      fromWarehouseId: data.fromWarehouseId,
      toWarehouseId: data.toWarehouseId,
      performedBy: user.id,
      idempotencyKey: data.idempotencyKey,
    })
  })

  revalidatePath("/inventory")
  revalidatePath("/laporan/inventory")
  return movement
}

export async function getStockOpnames(organizationId: string) {
  const { organization } = await requireCurrentOrganization()
  if (!organization || organization.id !== organizationId) {
    throw new Error("Unauthorized")
  }

  const stockOpnames = await prisma.stockOpname.findMany({
    where: { organizationId },
    include: {
      warehouse: {
        select: { id: true, code: true, name: true }
      },
      items: {
        include: {
          item: {
            select: { id: true, code: true, name: true }
          }
        }
      }
    },
    orderBy: { opnameDate: 'desc' }
  })

  return stockOpnames
}

export async function createStockOpname(data: {
  organizationId: string
  warehouseId: string
  code: string
  opnameDate: Date
  items: {
    itemId: string
    systemQuantity: number
    physicalQuantity: number
    unitCost?: number
  }[]
}) {
  const { user, organization } = await requireWritableCurrentOrganization()
  if (!user?.id || !organization || organization.id !== data.organizationId) {
    throw new Error("Unauthorized")
  }

  const warehouse = await prisma.warehouse.findFirst({
    where: { id: data.warehouseId, organizationId: data.organizationId },
    select: { id: true },
  })
  if (!warehouse) {
    throw new Error("Warehouse tidak ditemukan atau bukan milik organisasi aktif")
  }

  const itemIds = data.items.map((item) => item.itemId)
  if (itemIds.length > 0) {
    const validItems = await prisma.inventoryItem.count({
      where: {
        organizationId: data.organizationId,
        warehouseId: data.warehouseId,
        id: { in: itemIds },
      },
    })
    if (validItems !== itemIds.length) {
      throw new Error("Ada item stock opname yang tidak valid untuk warehouse ini")
    }
  }

  const stockOpname = await prisma.$transaction(async (tx) => {
    const created = await tx.stockOpname.create({
      data: {
        organizationId: data.organizationId,
        warehouseId: data.warehouseId,
        code: data.code,
        opnameDate: data.opnameDate,
        status: "DRAFT",
        performedBy: user.id
      }
    })

    await tx.stockOpnameItem.createMany({
      data: data.items.map(item => {
        const difference = item.physicalQuantity - item.systemQuantity
        const unitCost = item.unitCost || 0
        const totalDifference = difference * unitCost

        return {
          stockOpnameId: created.id,
          itemId: item.itemId,
          systemQuantity: item.systemQuantity,
          physicalQuantity: item.physicalQuantity,
          difference,
          unitCost,
          totalDifference
        }
      })
    })

    return created
  })

  revalidatePath("/inventory")
  return stockOpname
}

export async function completeStockOpname(id: string) {
  const { user, organization } = await requireWritableCurrentOrganization()
  if (!user?.id || !organization) {
    throw new Error("Unauthorized")
  }

  const stockOpname = await prisma.stockOpname.findFirst({
    where: { id, organizationId: organization.id },
    include: { items: true }
  })

  if (!stockOpname) {
    throw new Error("Stock Opname not found")
  }

  if (!["ADMIN", "MANAGER"].includes(user.role)) {
    await prisma.stockOpname.update({
      where: { id },
      data: { status: "PENDING_APPROVAL" },
    })
    revalidatePath("/inventory")
    return { success: true, pendingApproval: true }
  }

  await prisma.$transaction(async (tx) => {
    for (const row of stockOpname.items) {
      if (row.difference === 0) continue
      try {
        await adjustInventoryItemToQuantityInTx(tx, {
          organizationId: stockOpname.organizationId,
          itemId: row.itemId,
          targetQuantity: row.physicalQuantity,
          unitCost: row.unitCost ?? undefined,
          reference: `SO-${stockOpname.code}`,
          description: "Stock Opname Adjustment",
          performedBy: user.id,
          expectedWarehouseId: stockOpname.warehouseId,
        })
      } catch (error) {
        // If stock already matches target at approval time, skip quietly.
        const message = error instanceof Error ? error.message : String(error)
        if (!message.includes("Tidak ada selisih quantity")) {
          throw error
        }
      }
    }

    await tx.stockOpname.update({
      where: { id },
      data: {
        status: "COMPLETED",
        approvedBy: user.id,
        approvedAt: new Date(),
      },
    })
  })

  revalidatePath("/inventory")
  revalidatePath("/laporan/inventory")
  return { success: true, pendingApproval: false }
}
