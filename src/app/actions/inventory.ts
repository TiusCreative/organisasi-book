"use server"

import { prisma } from "@/lib/prisma"
import { requireCurrentOrganization } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import type { Prisma } from "@prisma/client"

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
  const { organization } = await requireCurrentOrganization()
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
}) {
  const { user } = await requireCurrentOrganization()
  if (!user?.id) {
    throw new Error("Unauthorized")
  }

  const item = await prisma.inventoryItem.findUnique({
    where: { id: data.itemId }
  })

  if (!item) {
    throw new Error("Inventory item not found")
  }

  const unitCost = data.unitCost || item.unitCost
  const totalCost = data.quantity * unitCost

  // Update inventory item quantity
  let newQuantity = item.quantity
  if (data.movementType === "IN") {
    newQuantity += data.quantity
    // Update average cost for FIFO/AVERAGE
    if (item.valuationMethod === "AVERAGE" && item.quantity > 0) {
      const totalValue = item.totalValue + totalCost
      newQuantity = item.quantity + data.quantity
      const newUnitCost = totalValue / newQuantity
      await prisma.inventoryItem.update({
        where: { id: data.itemId },
        data: {
          quantity: newQuantity,
          unitCost: newUnitCost,
          totalValue: totalValue
        }
      })
    } else {
      await prisma.inventoryItem.update({
        where: { id: data.itemId },
        data: {
          quantity: newQuantity,
          totalValue: item.totalValue + totalCost
        }
      })
    }
  } else if (data.movementType === "OUT") {
    newQuantity -= data.quantity
    await prisma.inventoryItem.update({
      where: { id: data.itemId },
      data: {
        quantity: newQuantity,
        totalValue: Math.max(0, item.totalValue - totalCost)
      }
    })
  } else if (data.movementType === "ADJUSTMENT") {
    newQuantity = data.quantity
    await prisma.inventoryItem.update({
      where: { id: data.itemId },
      data: {
        quantity: newQuantity,
        totalValue: newQuantity * unitCost
      }
    })
  }

  const movement = await prisma.inventoryMovement.create({
    data: {
      organizationId: data.organizationId,
      itemId: data.itemId,
      movementType: data.movementType,
      quantity: data.quantity,
      unitCost,
      totalCost,
      reference: data.reference,
      description: data.description,
      fromWarehouseId: data.fromWarehouseId,
      toWarehouseId: data.toWarehouseId,
      performedBy: user.id
    }
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
  const { user } = await requireCurrentOrganization()
  if (!user?.id) {
    throw new Error("Unauthorized")
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
  const { user } = await requireCurrentOrganization()
  if (!user?.id) {
    throw new Error("Unauthorized")
  }

  const stockOpname = await prisma.stockOpname.findUnique({
    where: { id },
    include: { items: true }
  })

  if (!stockOpname) {
    throw new Error("Stock Opname not found")
  }

  // Create adjustments for differences
  await prisma.$transaction(async (tx) => {
    for (const item of stockOpname.items) {
      if (item.difference !== 0) {
        // Update inventory item quantity
        const invItem = await tx.inventoryItem.findUnique({
          where: { id: item.itemId }
        })

        if (invItem) {
          await tx.inventoryItem.update({
            where: { id: item.itemId },
            data: {
              quantity: item.physicalQuantity,
              totalValue: item.physicalQuantity * (item.unitCost || invItem.unitCost)
            }
          })

          // Create inventory movement for adjustment
          await tx.inventoryMovement.create({
            data: {
              organizationId: stockOpname.organizationId,
              itemId: item.itemId,
              movementType: "ADJUSTMENT",
              quantity: Math.abs(item.difference),
              unitCost: item.unitCost,
              totalCost: Math.abs(item.totalDifference || 0),
              reference: `SO-${stockOpname.code}`,
              description: "Stock Opname Adjustment",
              performedBy: user.id
            }
          })
        }
      }
    }

    await tx.stockOpname.update({
      where: { id },
      data: { status: "COMPLETED" }
    })
  })

  revalidatePath("/inventory")
  revalidatePath("/laporan/inventory")
}
