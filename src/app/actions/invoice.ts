"use server"

import { prisma } from "../../lib/prisma"
import { revalidatePath } from "next/cache"
import { requireCurrentOrganization } from "../../lib/auth"
import { hasModulePermission } from "../../lib/permissions"
import { logAudit } from "../../lib/audit-logger"

// ==================== INVOICE ====================

export async function createInvoice(formData: FormData) {
  const { user, organization } = await requireCurrentOrganization()

  if (!hasModulePermission(user, "transactions")) {
    throw new Error("Anda tidak memiliki izin untuk membuat invoice.")
  }

  const customerId = formData.get("customerId") as string
  const invoiceDate = new Date(formData.get("invoiceDate") as string)
  const paymentTerm = parseInt((formData.get("paymentTerm") as string) || "30")
  const dueDate = new Date(invoiceDate)
  dueDate.setDate(dueDate.getDate() + paymentTerm)

  const itemsJson = formData.get("items") as string
  const items = JSON.parse(itemsJson)

  const subtotal = items.reduce((sum: number, item: any) => sum + item.subtotal, 0)
  const taxAmount = items.reduce((sum: number, item: any) => sum + item.taxAmount, 0)
  const totalAmount = items.reduce((sum: number, item: any) => sum + item.total, 0)

  // Generate invoice number
  const year = invoiceDate.getFullYear()
  const lastInvoice = await prisma.invoice.findFirst({
    where: {
      organizationId: organization.id,
      invoiceNumber: { startsWith: `INV-${year}` },
    },
    orderBy: { invoiceNumber: "desc" },
  })

  const lastNum = lastInvoice ? parseInt(lastInvoice.invoiceNumber.split("-")[2]) : 0
  const invoiceNumber = `INV-${year}-${String(lastNum + 1).padStart(4, "0")}`

  const invoice = await prisma.$transaction(async (tx) => {
    const created = await tx.invoice.create({
      data: {
        organizationId: organization.id,
        customerId,
        invoiceNumber,
        invoiceDate,
        dueDate,
        subtotal,
        taxAmount,
        totalAmount,
        remainingAmount: totalAmount,
      },
    })

    await tx.invoiceItem.createMany({
      data: items.map((item: any) => ({
        invoiceId: created.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        taxRate: item.taxRate,
        subtotal: item.subtotal,
        taxAmount: item.taxAmount,
        total: item.total,
      })),
    })

    return created
  })

  await logAudit({
    organizationId: organization.id,
    action: "CREATE",
    entity: "Invoice",
    entityId: invoice.id,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    newData: invoice,
  })

  revalidatePath("/arap")
  return { success: true, invoice }
}

export async function updateInvoice(formData: FormData) {
  const { user } = await requireCurrentOrganization()

  if (!hasModulePermission(user, "transactions")) {
    throw new Error("Anda tidak memiliki izin untuk mengubah invoice.")
  }

  const id = formData.get("id") as string
  const status = formData.get("status") as string
  const notes = formData.get("notes") as string

  const oldInvoice = await prisma.invoice.findUnique({ where: { id } })

  if (!oldInvoice) {
    throw new Error("Invoice tidak ditemukan")
  }

  if (oldInvoice.status !== "DRAFT" && status !== "CANCELLED") {
    throw new Error("Hanya invoice dengan status DRAFT yang dapat diubah.")
  }

  const invoice = await prisma.invoice.update({
    where: { id },
    data: {
      status,
      notes,
    },
  })

  await logAudit({
    organizationId: invoice.organizationId,
    action: "UPDATE",
    entity: "Invoice",
    entityId: id,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    oldData: oldInvoice,
    newData: invoice,
  })

  revalidatePath("/arap")
  return { success: true, invoice }
}

export async function addInvoicePayment(formData: FormData) {
  const { user, organization } = await requireCurrentOrganization()

  if (!hasModulePermission(user, "transactions")) {
    throw new Error("Anda tidak memiliki izin untuk menambah pembayaran invoice.")
  }

  const invoiceId = formData.get("invoiceId") as string
  const paymentDate = new Date(formData.get("paymentDate") as string)
  const amount = parseFloat(formData.get("amount") as string)
  const paymentMethod = formData.get("paymentMethod") as string
  const bankAccountId = formData.get("bankAccountId") as string
  const referenceNumber = formData.get("referenceNumber") as string
  const notes = formData.get("notes") as string

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } })

  if (!invoice) {
    throw new Error("Invoice tidak ditemukan")
  }

  if (amount > invoice.remainingAmount) {
    throw new Error("Jumlah pembayaran melebihi sisa invoice")
  }

  await prisma.$transaction(async (tx) => {
    await tx.invoicePayment.create({
      data: {
        organizationId: organization.id,
        invoiceId,
        paymentDate,
        amount,
        paymentMethod,
        bankAccountId,
        referenceNumber,
        notes,
      },
    })

    const paidAmount = invoice.paidAmount + amount
    const remainingAmount = invoice.totalAmount - paidAmount
    const status = remainingAmount === 0 ? "PAID" : "PARTIALLY_PAID"

    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        paidAmount,
        remainingAmount,
        status,
      },
    })
  })

  await logAudit({
    organizationId: organization.id,
    action: "UPDATE",
    entity: "Invoice",
    entityId: invoiceId,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    newData: { paymentAmount: amount },
  })

  revalidatePath("/arap")
  return { success: true }
}

export async function getInvoices(status?: string) {
  const { organization } = await requireCurrentOrganization()

  const where: any = { organizationId: organization.id }
  if (status) where.status = status

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      customer: true,
      items: true,
      payments: true,
    },
    orderBy: { invoiceDate: "desc" },
  })

  return { success: true, invoices }
}

// ==================== VENDOR BILL ====================

export async function createVendorBill(formData: FormData) {
  const { user, organization } = await requireCurrentOrganization()

  if (!hasModulePermission(user, "transactions")) {
    throw new Error("Anda tidak memiliki izin untuk membuat vendor bill.")
  }

  const supplierId = formData.get("supplierId") as string
  const billDate = new Date(formData.get("billDate") as string)
  const paymentTerm = parseInt((formData.get("paymentTerm") as string) || "30")
  const dueDate = new Date(billDate)
  dueDate.setDate(dueDate.getDate() + paymentTerm)

  const itemsJson = formData.get("items") as string
  const items = JSON.parse(itemsJson)

  const subtotal = items.reduce((sum: number, item: any) => sum + item.subtotal, 0)
  const taxAmount = items.reduce((sum: number, item: any) => sum + item.taxAmount, 0)
  const totalAmount = items.reduce((sum: number, item: any) => sum + item.total, 0)

  // Generate bill number
  const year = billDate.getFullYear()
  const lastBill = await prisma.vendorBill.findFirst({
    where: {
      organizationId: organization.id,
      billNumber: { startsWith: `BILL-${year}` },
    },
    orderBy: { billNumber: "desc" },
  })

  const lastNum = lastBill ? parseInt(lastBill.billNumber.split("-")[2]) : 0
  const billNumber = `BILL-${year}-${String(lastNum + 1).padStart(4, "0")}`

  const vendorBill = await prisma.$transaction(async (tx) => {
    const created = await tx.vendorBill.create({
      data: {
        organizationId: organization.id,
        supplierId,
        billNumber,
        billDate,
        dueDate,
        subtotal,
        taxAmount,
        totalAmount,
        remainingAmount: totalAmount,
      },
    })

    await tx.vendorBillItem.createMany({
      data: items.map((item: any) => ({
        vendorBillId: created.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        taxRate: item.taxRate,
        subtotal: item.subtotal,
        taxAmount: item.taxAmount,
        total: item.total,
      })),
    })

    return created
  })

  await logAudit({
    organizationId: organization.id,
    action: "CREATE",
    entity: "VendorBill",
    entityId: vendorBill.id,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    newData: vendorBill,
  })

  revalidatePath("/arap")
  return { success: true, vendorBill }
}

export async function updateVendorBill(formData: FormData) {
  const { user } = await requireCurrentOrganization()

  if (!hasModulePermission(user, "transactions")) {
    throw new Error("Anda tidak memiliki izin untuk mengubah vendor bill.")
  }

  const id = formData.get("id") as string
  const status = formData.get("status") as string
  const notes = formData.get("notes") as string

  const oldBill = await prisma.vendorBill.findUnique({ where: { id } })

  if (!oldBill) {
    throw new Error("Vendor bill tidak ditemukan")
  }

  if (oldBill.status !== "DRAFT" && status !== "CANCELLED") {
    throw new Error("Hanya vendor bill dengan status DRAFT yang dapat diubah.")
  }

  const vendorBill = await prisma.vendorBill.update({
    where: { id },
    data: {
      status,
      notes,
    },
  })

  await logAudit({
    organizationId: vendorBill.organizationId,
    action: "UPDATE",
    entity: "VendorBill",
    entityId: id,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    oldData: oldBill,
    newData: vendorBill,
  })

  revalidatePath("/arap")
  return { success: true, vendorBill }
}

export async function addVendorBillPayment(formData: FormData) {
  const { user, organization } = await requireCurrentOrganization()

  if (!hasModulePermission(user, "transactions")) {
    throw new Error("Anda tidak memiliki izin untuk menambah pembayaran vendor bill.")
  }

  const vendorBillId = formData.get("vendorBillId") as string
  const paymentDate = new Date(formData.get("paymentDate") as string)
  const amount = parseFloat(formData.get("amount") as string)
  const paymentMethod = formData.get("paymentMethod") as string
  const bankAccountId = formData.get("bankAccountId") as string
  const referenceNumber = formData.get("referenceNumber") as string
  const notes = formData.get("notes") as string

  const vendorBill = await prisma.vendorBill.findUnique({ where: { id: vendorBillId } })

  if (!vendorBill) {
    throw new Error("Vendor bill tidak ditemukan")
  }

  if (amount > vendorBill.remainingAmount) {
    throw new Error("Jumlah pembayaran melebihi sisa vendor bill")
  }

  await prisma.$transaction(async (tx) => {
    await tx.vendorBillPayment.create({
      data: {
        organizationId: organization.id,
        vendorBillId,
        paymentDate,
        amount,
        paymentMethod,
        bankAccountId,
        referenceNumber,
        notes,
      },
    })

    const paidAmount = vendorBill.paidAmount + amount
    const remainingAmount = vendorBill.totalAmount - paidAmount
    const status = remainingAmount === 0 ? "PAID" : "PARTIALLY_PAID"

    await tx.vendorBill.update({
      where: { id: vendorBillId },
      data: {
        paidAmount,
        remainingAmount,
        status,
      },
    })
  })

  await logAudit({
    organizationId: organization.id,
    action: "UPDATE",
    entity: "VendorBill",
    entityId: vendorBillId,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    newData: { paymentAmount: amount },
  })

  revalidatePath("/arap")
  return { success: true }
}

export async function getVendorBills(status?: string) {
  const { organization } = await requireCurrentOrganization()

  const where: any = { organizationId: organization.id }
  if (status) where.status = status

  const vendorBills = await prisma.vendorBill.findMany({
    where,
    include: {
      supplier: true,
      items: true,
      payments: true,
    },
    orderBy: { billDate: "desc" },
  })

  return { success: true, vendorBills }
}
