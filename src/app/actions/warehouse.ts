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
  
  const count = await prisma.warehouse.count({ where: { organizationId: organization.id } })
  const code = `WH-${String(count + 1).padStart(3, "0")}`

  const warehouse = await prisma.warehouse.create({
    data: { organizationId: organization.id, code, name, location, type, managerId, status, notes }
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

  const warehouse = await prisma.warehouse.update({
    where: { id, organizationId: organization.id },
    data: { name, location, type, managerId, status, notes }
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