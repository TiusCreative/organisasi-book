"use server"

import { prisma } from "../../lib/prisma"
import { requireCurrentOrganization } from "../../lib/auth"
import { revalidatePath } from "next/cache"

export async function createPurchaseOrder(formData: FormData) {
  const { organization, user } = await requireCurrentOrganization()

  if (!user.permissions.includes("arap")) {
    throw new Error("Anda tidak memiliki izin untuk membuat Purchase Order.")
  }

  const supplierId = formData.get("supplierId") as string
  const orderDate = new Date(formData.get("orderDate") as string)
  const expectedDate = formData.get("expectedDate") ? new Date(formData.get("expectedDate") as string) : null
  const notes = formData.get("notes") as string | null
  const itemsJson = formData.get("items") as string

  const items = JSON.parse(itemsJson)

  // Generate PO number
  const year = new Date().getFullYear()
  const lastPO = await prisma.purchaseOrder.findFirst({
    where: {
      organizationId: organization.id,
      poNumber: { startsWith: `PO-${year}` },
    },
    orderBy: { poNumber: "desc" },
  })

  let sequence = 1
  if (lastPO) {
    const lastSequence = parseInt(lastPO.poNumber.split("-")[2])
    sequence = lastSequence + 1
  }
  const poNumber = `PO-${year}-${sequence.toString().padStart(4, "0")}`

  // Calculate totals
  let subtotal = 0
  let taxAmount = 0
  let discountAmount = 0

  const calculatedItems = items.map((item: any) => {
    const itemSubtotal = parseFloat(item.quantity) * parseFloat(item.unitPrice)
    const itemDiscount = itemSubtotal * (parseFloat(item.discount) / 100)
    const itemTax = (itemSubtotal - itemDiscount) * (parseFloat(item.taxRate) / 100)
    const itemTotal = itemSubtotal - itemDiscount + itemTax

    subtotal += itemSubtotal
    discountAmount += itemDiscount
    taxAmount += itemTax

    return {
      ...item,
      subtotal: itemSubtotal,
      taxAmount: itemTax,
      total: itemTotal,
    }
  })

  const totalAmount = subtotal - discountAmount + taxAmount

  const po = await prisma.purchaseOrder.create({
    data: {
      organizationId: organization.id,
      supplierId,
      poNumber,
      orderDate,
      expectedDate,
      status: "DRAFT",
      subtotal,
      taxAmount,
      discountAmount,
      totalAmount,
      notes,
      items: {
        create: calculatedItems.map((item: any) => ({
          description: item.description,
          quantity: parseFloat(item.quantity),
          unitPrice: parseFloat(item.unitPrice),
          discount: parseFloat(item.discount),
          taxRate: parseFloat(item.taxRate),
          subtotal: item.subtotal,
          taxAmount: item.taxAmount,
          total: item.total,
        })),
      },
    },
    include: { supplier: true, items: true },
  })

  revalidatePath("/po")
  revalidatePath("/arap")
  return { success: true, po }
}

export async function updatePurchaseOrderStatus(formData: FormData) {
  const { organization, user } = await requireCurrentOrganization()

  if (!user.permissions.includes("arap")) {
    throw new Error("Anda tidak memiliki izin untuk mengubah status Purchase Order.")
  }

  const id = formData.get("id") as string
  const status = formData.get("status") as string

  const po = await prisma.purchaseOrder.update({
    where: { id },
    data: { status },
  })

  revalidatePath("/po")
  revalidatePath("/arap")
  return { success: true, po }
}

export async function getPurchaseOrders() {
  const { organization } = await requireCurrentOrganization()

  const pos = await prisma.purchaseOrder.findMany({
    where: { organizationId: organization.id },
    include: { supplier: true, items: true },
    orderBy: { orderDate: "desc" },
  })

  return { success: true, purchaseOrders: pos }
}

export async function getPurchaseOrderById(id: string) {
  const { organization } = await requireCurrentOrganization()

  const po = await prisma.purchaseOrder.findFirst({
    where: { id, organizationId: organization.id },
    include: { supplier: true, items: true },
  })

  if (!po) {
    throw new Error("Purchase Order tidak ditemukan")
  }

  return { success: true, po }
}
