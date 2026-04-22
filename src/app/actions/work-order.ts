"use server"

import { prisma } from "@/lib/prisma"
import { requireCurrentOrganization } from "@/lib/auth"
import { revalidatePath } from "next/cache"

export async function getWorkOrders(organizationId: string) {
  const { organization } = await requireCurrentOrganization()
  if (!organization || organization.id !== organizationId) {
    throw new Error("Unauthorized")
  }

  const workOrders = await prisma.workOrder.findMany({
    where: { organizationId },
    include: {
      assignedUser: {
        select: { id: true, name: true, email: true }
      },
      customer: {
        select: { id: true, name: true, code: true }
      },
      items: true
    },
    orderBy: { createdAt: 'desc' }
  })

  return workOrders
}

export async function createWorkOrder(data: {
  organizationId: string
  code: string
  barcode?: string
  title: string
  description?: string
  customerId?: string
  priority?: string
  assignedTo?: string
  startDate?: Date
  dueDate?: Date
  estimatedHours?: number
  items?: {
    description: string
    quantity: number
    unit?: string
    unitPrice?: number
  }[]
}) {
  const { organization } = await requireCurrentOrganization()
  if (!organization || organization.id !== data.organizationId) {
    throw new Error("Unauthorized")
  }

  const workOrder = await prisma.$transaction(async (tx) => {
    const created = await tx.workOrder.create({
      data: {
        organizationId: data.organizationId,
        code: data.code,
        barcode: data.barcode,
        title: data.title,
        description: data.description,
        customerId: data.customerId,
        priority: data.priority || "MEDIUM",
        assignedTo: data.assignedTo,
        startDate: data.startDate,
        dueDate: data.dueDate,
        estimatedHours: data.estimatedHours,
        status: "PENDING"
      }
    })

    if (data.items && data.items.length > 0) {
      await tx.workOrderItem.createMany({
        data: data.items.map(item => ({
          workOrderId: created.id,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice || 0,
          totalPrice: (item.quantity || 0) * (item.unitPrice || 0)
        }))
      })
    }

    return created
  })

  revalidatePath("/work-order")
  return workOrder
}

export async function updateWorkOrderStatus(id: string, status: string) {
  const { user } = await requireCurrentOrganization()
  if (!user?.id) {
    throw new Error("Unauthorized")
  }

  const workOrder = await prisma.workOrder.findUnique({
    where: { id }
  })

  if (!workOrder) {
    throw new Error("Work Order not found")
  }

  const data: any = { status }
  if (status === "COMPLETED") {
    data.completedAt = new Date()
  }

  const updated = await prisma.workOrder.update({
    where: { id },
    data
  })

  revalidatePath("/work-order")
  return updated
}

export async function getWarehouses(organizationId: string) {
  const { organization } = await requireCurrentOrganization()
  if (!organization || organization.id !== organizationId) {
    throw new Error("Unauthorized")
  }

  const warehouses = await prisma.warehouse.findMany({
    where: { 
      organizationId,
      status: "ACTIVE"
    },
    include: {
      manager: {
        select: { id: true, name: true }
      }
    },
    orderBy: { code: 'asc' }
  })

  return warehouses
}

export async function createWarehouse(data: {
  organizationId: string
  code: string
  name: string
  location?: string
  type?: string
  managerId?: string
}) {
  const { organization } = await requireCurrentOrganization()
  if (!organization || organization.id !== data.organizationId) {
    throw new Error("Unauthorized")
  }

  const warehouse = await prisma.warehouse.create({
    data: {
      organizationId: data.organizationId,
      code: data.code,
      name: data.name,
      location: data.location,
      type: data.type || "MAIN",
      managerId: data.managerId
    }
  })

  revalidatePath("/inventory")
  return warehouse
}
