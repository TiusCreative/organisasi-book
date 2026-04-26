"use server"

import { prisma } from "@/lib/prisma"
import { requireModuleAccess } from "@/lib/auth"
import { revalidatePath } from "next/cache"

export async function getWarehouses() {
  try {
    const { organization } = await requireModuleAccess("warehouse")
    
    const warehouses = await prisma.warehouse.findMany({
      where: { organizationId: organization.id, status: "ACTIVE" },
      orderBy: { name: "asc" }
    })
    return { success: true, warehouses }
  } catch (error) {
    return { success: false, warehouses: [] }
  }
}

export async function getInventoryMovements(filters?: { type?: string; itemId?: string }) {
  try {
    const { organization } = await requireModuleAccess("warehouse")
    
    const whereClause: any = { organizationId: organization.id }
    if (filters?.type) whereClause.movementType = filters.type
    if (filters?.itemId) whereClause.itemId = filters.itemId

    const movements = await prisma.inventoryMovement.findMany({
      where: whereClause,
      include: { item: true },
      orderBy: { createdAt: "desc" },
    })
    return { success: true, movements }
  } catch (error) {
    return { success: false, movements: [] }
  }
}

export async function createWarehouse(formData: FormData) {
  const { organization } = await requireModuleAccess("warehouse" as any)
  
  const name = formData.get("name") as string
  const location = formData.get("location") as string
  const type = formData.get("type") as string
  const managerId = (formData.get("managerId") as string) || null
  const status = formData.get("status") as string
  const notes = formData.get("notes") as string
  const imageUrl = (formData.get("imageUrl") as string) || null
  
  const count = await prisma.warehouse.count({ where: { organizationId: organization.id } })
  const code = `WH-${String(count + 1).padStart(3, "0")}`

  const warehouse = await prisma.warehouse.create({
    data: { organizationId: organization.id, code, name, location, type, managerId, status, notes, imageUrl }
  })
  
  revalidatePath("/warehouse")
  return { success: true, warehouse }
}

export async function updateWarehouse(formData: FormData) {
  const { organization } = await requireModuleAccess("warehouse" as any)
  
  const id = formData.get("id") as string
  const name = formData.get("name") as string
  const location = formData.get("location") as string
  const type = formData.get("type") as string
  const managerId = (formData.get("managerId") as string) || null
  const status = formData.get("status") as string
  const notes = formData.get("notes") as string
  const imageUrl = (formData.get("imageUrl") as string) || null

  const warehouse = await prisma.warehouse.update({
    where: { id, organizationId: organization.id },
    data: { name, location, type, managerId, status, notes, imageUrl }
  })
  
  revalidatePath("/warehouse")
  return { success: true, warehouse }
}

export async function deleteWarehouse(id: string) {
  const { organization } = await requireModuleAccess("warehouse" as any)
  
  await prisma.warehouse.delete({ where: { id, organizationId: organization.id } })
  
  revalidatePath("/warehouse")
  return { success: true }
}

export async function getWarehouseDashboardData() {
  try {
    const { organization } = await requireModuleAccess("warehouse")
    
    // Jalankan query agregasi secara paralel untuk performa optimal
    const [
      inventoryAgg,
      lowStockItemsRaw,
      lowStockCountRaw,
      pendingInbound,
      pendingOutbound,
      movements
    ] = await Promise.all([
      // 1. Total Valuasi Inventory
      prisma.inventoryItem.aggregate({
        where: { organizationId: organization.id, status: 'ACTIVE' },
        _sum: { totalValue: true }
      }),
      // 2. Daftar Item Stok Tipis (menggunakan Raw Query untuk komparasi 2 kolom)
      prisma.$queryRawUnsafe<any[]>(`
        SELECT i.id, i.name, w.name as "warehouseName", i.quantity as "currentStock", i."minStock"
        FROM "InventoryItem" i
        JOIN "Warehouse" w ON i."warehouseId" = w.id
        WHERE i."organizationId" = $1
          AND i.quantity <= i."minStock"
          AND i."minStock" > 0
        ORDER BY i.quantity ASC
        LIMIT 5
      `, organization.id),
      // 3. Count Total Item Stok Tipis
      prisma.$queryRawUnsafe<{count: number}[]>(`
        SELECT COUNT(*)::int as count
        FROM "InventoryItem"
        WHERE "organizationId" = $1
          AND quantity <= "minStock"
          AND "minStock" > 0
      `, organization.id),
      // 4. Pending Inbound (PO yang siap masuk gudang)
      prisma.purchaseOrder.count({
        where: { organizationId: organization.id, status: { in: ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'] } }
      }),
      // 5. Pending Outbound (SO yang siap dikirim/picking)
      prisma.salesOrder.count({
        where: { organizationId: organization.id, status: { in: ['APPROVED', 'PROCESSING'] } }
      }),
      // 6. Aktivitas Terakhir
      prisma.inventoryMovement.findMany({
        where: { organizationId: organization.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { item: { select: { name: true } } }
      })
    ])

    return {
      success: true,
      metrics: {
        totalInventoryValue: Number(inventoryAgg._sum.totalValue || 0),
        lowStockCount: Number(lowStockCountRaw[0]?.count || 0),
        pendingInboundCount: pendingInbound,
        pendingOutboundCount: pendingOutbound,
      },
      lowStockItems: lowStockItemsRaw.map(item => ({
        id: item.id,
        name: item.name,
        warehouseName: item.warehouseName,
        currentStock: Number(item.currentStock),
        minStock: Number(item.minStock)
      })),
      recentMovements: movements.map(mov => ({
        id: mov.id,
        type: mov.movementType,
        itemName: mov.item?.name || 'Unknown Item',
        quantity: Number(mov.quantity),
        reference: mov.reference,
        actorName: mov.performedBy || 'System',
        date: mov.createdAt
      }))
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}