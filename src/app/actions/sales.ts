"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireCurrentOrganization } from "@/lib/auth"
import { hasModulePermission } from "@/lib/permissions"
import { postInventoryMovementInTx } from "@/lib/inventory-ledger"

type SalesOrderItemInput = {
  itemId: string
  quantity: number
  unitPrice: number
  discountPercent?: number
  taxPercent?: number
  notes?: string
}

type DeliveryItemInput = {
  salesOrderItemId: string
  quantity: number
  notes?: string
}

function assertSalesPrismaDelegates() {
  const prismaClient = prisma as unknown as Record<string, unknown>
  const requiredDelegates = ["salesOrder", "salesOrderItem", "deliveryOrder", "deliveryOrderItem", "salesCommission"]
  const missingDelegates = requiredDelegates.filter((name) => typeof prismaClient[name] === "undefined")

  if (missingDelegates.length > 0) {
    throw new Error(
      `Prisma Client belum memuat model Sales (${missingDelegates.join(", ")}). Jalankan 'npx prisma generate' lalu restart total server Next.js.`,
    )
  }
}

function generateRunningCode(prefix: string, year: number, sequence: number) {
  return `${prefix}-${year}-${String(sequence).padStart(4, "0")}`
}

async function getNextCode(organizationId: string, entity: "SO" | "DO") {
  assertSalesPrismaDelegates()

  const year = new Date().getFullYear()
  const startsWith = `${entity}-${year}-`

  if (entity === "SO") {
    const latest = await prisma.salesOrder.findFirst({
      where: { organizationId, code: { startsWith } },
      orderBy: { code: "desc" },
      select: { code: true },
    })

    const latestSeq = latest ? Number.parseInt(latest.code.split("-")[2] || "0", 10) : 0
    return generateRunningCode("SO", year, latestSeq + 1)
  }

  const latest = await prisma.deliveryOrder.findFirst({
    where: { organizationId, code: { startsWith } },
    orderBy: { code: "desc" },
    select: { code: true },
  })

  const latestSeq = latest ? Number.parseInt(latest.code.split("-")[2] || "0", 10) : 0
  return generateRunningCode("DO", year, latestSeq + 1)
}

function calculateSalesOrderTotals(items: SalesOrderItemInput[]) {
  const computed = items.map((item) => {
    const quantity = Number(item.quantity || 0)
    const unitPrice = Number(item.unitPrice || 0)
    const discountPercent = Number(item.discountPercent || 0)
    const taxPercent = Number(item.taxPercent || 0)

    const gross = quantity * unitPrice
    const discountAmount = gross * (discountPercent / 100)
    const taxable = gross - discountAmount
    const taxAmount = taxable * (taxPercent / 100)
    const totalPrice = taxable + taxAmount

    return {
      ...item,
      quantity,
      unitPrice,
      discountPercent,
      discountAmount,
      taxPercent,
      taxAmount,
      totalPrice,
    }
  })

  const subtotal = computed.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  const discountAmount = computed.reduce((sum, item) => sum + item.discountAmount, 0)
  const taxAmount = computed.reduce((sum, item) => sum + item.taxAmount, 0)
  const totalAmount = computed.reduce((sum, item) => sum + item.totalPrice, 0)

  return {
    items: computed,
    subtotal,
    discountAmount,
    taxAmount,
    totalAmount,
  }
}

export async function getSalesModuleData() {
  assertSalesPrismaDelegates()

  const { organization } = await requireCurrentOrganization()

  const [customers, salesUsers, inventoryItems, salesOrders, deliveryOrders, invoices, commissions] = await Promise.all([
    prisma.customer.findMany({
      where: { organizationId: organization.id, status: "ACTIVE" },
      select: { id: true, code: true, name: true, paymentTerm: true, phone: true, address: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { organizationId: organization.id, status: "ACTIVE" },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.inventoryItem.findMany({
      where: { organizationId: organization.id, status: "ACTIVE" },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ name: "asc" }],
    }),
    prisma.salesOrder.findMany({
      where: { organizationId: organization.id },
      include: {
        customer: { select: { id: true, code: true, name: true, phone: true, address: true } },
        salesPerson: { select: { id: true, name: true } },
        items: {
          include: {
            item: {
              select: {
                id: true,
                code: true,
                barcode: true,
                name: true,
                unit: true,
                quantity: true,
                warehouse: { select: { id: true, code: true, name: true } },
              },
            },
          },
        },
        deliveryOrders: true,
        commission: true,
      },
      orderBy: { orderDate: "desc" },
      take: 200,
    }),
    prisma.deliveryOrder.findMany({
      where: { organizationId: organization.id },
      include: {
        customer: { select: { id: true, code: true, name: true } },
        salesOrder: { select: { id: true, code: true } },
        items: {
          include: {
            item: { select: { id: true, code: true, barcode: true, name: true, unit: true } },
          },
        },
      },
      orderBy: { deliveryDate: "desc" },
      take: 200,
    }),
    prisma.invoice.findMany({
      where: {
        organizationId: organization.id,
        OR: [{ invoiceNumber: { startsWith: "INV-SO-" } }, { notes: { contains: "AUTO_FROM_SO:" } }],
      },
      include: {
        customer: { select: { id: true, code: true, name: true, phone: true, address: true } },
        items: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.salesCommission.findMany({
      where: { organizationId: organization.id },
      include: {
        salesOrder: { select: { id: true, code: true, totalAmount: true, orderDate: true, status: true } },
        salesPerson: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ])

  return {
    organization,
    customers,
    salesUsers,
    inventoryItems,
    salesOrders,
    deliveryOrders,
    invoices,
    commissions,
  }
}

export async function createSalesOrder(data: {
  customerId: string
  salesPersonId?: string
  orderDate?: string
  deliveryDate?: string
  priority?: string
  notes?: string
  terms?: string
  internalNotes?: string
  commissionRate?: number
  items: SalesOrderItemInput[]
}) {
  assertSalesPrismaDelegates()

  const { user, organization } = await requireCurrentOrganization()

  if (!hasModulePermission(user, "sales")) {
    throw new Error("Anda tidak memiliki izin untuk membuat sales order.")
  }

  if (!data.customerId) {
    throw new Error("Customer wajib dipilih.")
  }

  if (!data.items || data.items.length === 0) {
    throw new Error("Item sales order minimal 1 baris.")
  }

  const cleanItems = data.items.filter((item) => item.itemId && Number(item.quantity) > 0)
  if (cleanItems.length === 0) {
    throw new Error("Item sales order tidak valid.")
  }

  const itemIds = cleanItems.map((item) => item.itemId)
  const dbItems = await prisma.inventoryItem.findMany({
    where: { organizationId: organization.id, id: { in: itemIds } },
    select: { id: true, quantity: true, name: true },
  })

  if (dbItems.length !== itemIds.length) {
    throw new Error("Sebagian item tidak ditemukan pada stok organisasi aktif.")
  }

  for (const line of cleanItems) {
    const stockItem = dbItems.find((item) => item.id === line.itemId)
    if (!stockItem) {
      throw new Error("Item stok tidak ditemukan.")
    }
    if (line.quantity > stockItem.quantity) {
      throw new Error(`Stok tidak cukup untuk item ${stockItem.name}.`) 
    }
  }

  const totals = calculateSalesOrderTotals(cleanItems)
  const code = await getNextCode(organization.id, "SO")

  const salesOrder = await prisma.$transaction(async (tx) => {
    const created = await tx.salesOrder.create({
      data: {
        organizationId: organization.id,
        code,
        customerId: data.customerId,
        salesPersonId: data.salesPersonId || null,
        orderDate: data.orderDate ? new Date(data.orderDate) : new Date(),
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
        status: "CONFIRMED",
        priority: data.priority || "NORMAL",
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
        notes: data.notes || null,
        terms: data.terms || null,
        internalNotes: data.internalNotes || null,
      },
    })

    await tx.salesOrderItem.createMany({
      data: totals.items.map((item) => ({
        salesOrderId: created.id,
        itemId: item.itemId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPercent: item.discountPercent,
        discountAmount: item.discountAmount,
        taxPercent: item.taxPercent,
        taxAmount: item.taxAmount,
        totalPrice: item.totalPrice,
        notes: item.notes || null,
      })),
    })

    if (data.salesPersonId) {
      const rate = Number(data.commissionRate ?? 5)
      const commissionAmount = totals.totalAmount * (rate / 100)
      await tx.salesCommission.upsert({
        where: { salesOrderId: created.id },
        create: {
          organizationId: organization.id,
          salesOrderId: created.id,
          salesPersonId: data.salesPersonId,
          baseAmount: totals.totalAmount,
          commissionRate: rate / 100,
          commissionAmount,
          bonusAmount: 0,
          totalCommission: commissionAmount,
          status: "PENDING",
        },
        update: {
          salesPersonId: data.salesPersonId,
          baseAmount: totals.totalAmount,
          commissionRate: rate / 100,
          commissionAmount,
          totalCommission: commissionAmount,
        },
      })
    }

    return created
  })

  revalidatePath("/sales")
  revalidatePath("/laporan/sales")

  return { success: true, salesOrder }
}

export async function updateSalesOrderStatus(data: {
  salesOrderId: string
  status: "DRAFT" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED"
  notes?: string
}) {
  assertSalesPrismaDelegates()

  const { user, organization } = await requireCurrentOrganization()

  if (!hasModulePermission(user, "sales")) {
    throw new Error("Anda tidak memiliki izin mengubah sales order.")
  }

  const current = await prisma.salesOrder.findFirst({
    where: { id: data.salesOrderId, organizationId: organization.id },
  })
  if (!current) {
    throw new Error("Sales order tidak ditemukan.")
  }

  const salesOrder = await prisma.salesOrder.update({
    where: { id: data.salesOrderId },
    data: {
      status: data.status,
      notes: data.notes ?? current.notes,
    },
  })

  revalidatePath("/sales")
  return { success: true, salesOrder }
}

export async function deleteSalesOrder(salesOrderId: string) {
  assertSalesPrismaDelegates()

  const { user, organization } = await requireCurrentOrganization()

  if (user.role !== "ADMIN") {
    throw new Error("Hanya admin yang dapat menghapus sales order.")
  }

  const current = await prisma.salesOrder.findFirst({
    where: { id: salesOrderId, organizationId: organization.id },
    include: {
      deliveryOrders: { select: { id: true } },
    },
  })
  if (!current) {
    throw new Error("Sales order tidak ditemukan.")
  }

  if (current.deliveryOrders.length > 0) {
    throw new Error("Sales order sudah memiliki delivery order dan tidak dapat dihapus.")
  }

  const existingInvoice = await prisma.invoice.findFirst({
    where: {
      organizationId: organization.id,
      OR: [
        { invoiceNumber: { startsWith: `INV-${current.code}` } },
        { notes: { contains: `AUTO_FROM_SO:${current.code}` } },
      ],
    },
    select: { id: true },
  })

  if (existingInvoice) {
    throw new Error("Sales order sudah memiliki invoice dan tidak dapat dihapus.")
  }

  await prisma.salesOrder.delete({ where: { id: salesOrderId } })
  revalidatePath("/sales")
  return { success: true }
}

export async function createDeliveryOrderFromSalesOrder(data: {
  salesOrderId: string
  deliveryDate?: string
  deliveryAddress?: string
  driverName?: string
  driverPhone?: string
  vehiclePlate?: string
  notes?: string
  trackingNumber?: string
  items?: DeliveryItemInput[]
}) {
  assertSalesPrismaDelegates()

  const { user, organization } = await requireCurrentOrganization()

  if (!hasModulePermission(user, "deliveryOrder")) {
    throw new Error("Anda tidak memiliki izin untuk membuat delivery order.")
  }

  const salesOrder = await prisma.salesOrder.findFirst({
    where: { id: data.salesOrderId, organizationId: organization.id },
    include: {
      items: {
        include: {
          item: { select: { id: true, quantity: true, unitCost: true, totalValue: true, name: true } },
        },
      },
      customer: true,
    },
  })

  if (!salesOrder) {
    throw new Error("Sales order tidak ditemukan.")
  }

  const requestedItems = data.items && data.items.length > 0
    ? data.items
    : salesOrder.items
        .filter((row) => row.quantity > row.deliveredQty)
        .map((row) => ({ salesOrderItemId: row.id, quantity: row.quantity - row.deliveredQty }))

  if (requestedItems.length === 0) {
    throw new Error("Semua item pada sales order sudah dikirim.")
  }

  const code = await getNextCode(organization.id, "DO")

  const deliveryOrder = await prisma.$transaction(async (tx) => {
    const created = await tx.deliveryOrder.create({
      data: {
        organizationId: organization.id,
        code,
        salesOrderId: salesOrder.id,
        customerId: salesOrder.customerId,
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : new Date(),
        status: "SHIPPED",
        driverName: data.driverName || null,
        driverPhone: data.driverPhone || null,
        vehiclePlate: data.vehiclePlate || null,
        deliveryAddress: data.deliveryAddress || salesOrder.customer.address || null,
        notes: data.notes || null,
        trackingNumber: data.trackingNumber || null,
        shippedAt: new Date(),
      },
    })

    for (const reqItem of requestedItems) {
      const soItem = salesOrder.items.find((row) => row.id === reqItem.salesOrderItemId)
      if (!soItem) {
        throw new Error("Item sales order tidak ditemukan.")
      }

      const qty = Number(reqItem.quantity || 0)
      if (qty <= 0) {
        throw new Error("Qty kirim harus lebih dari 0.")
      }

      const remaining = soItem.quantity - soItem.deliveredQty
      if (qty > remaining) {
        throw new Error(`Qty kirim melebihi sisa untuk item ${soItem.item.name}.`)
      }

      if (qty > soItem.item.quantity) {
        throw new Error(`Stok item ${soItem.item.name} tidak cukup untuk pengiriman.`)
      }

      await tx.deliveryOrderItem.create({
        data: {
          deliveryOrderId: created.id,
          salesOrderItemId: soItem.id,
          itemId: soItem.itemId,
          quantity: qty,
          notes: reqItem.notes || null,
        },
      })

      await tx.salesOrderItem.update({
        where: { id: soItem.id },
        data: { deliveredQty: soItem.deliveredQty + qty },
      })

      await postInventoryMovementInTx(tx, {
        organizationId: organization.id,
        itemId: soItem.itemId,
        movementType: "OUT",
        quantity: qty,
        reference: created.code,
        description: `Pengiriman dari Sales Order ${salesOrder.code}`,
        performedBy: user.id,
      })
    }

    const refreshedItems = await tx.salesOrderItem.findMany({
      where: { salesOrderId: salesOrder.id },
      select: { quantity: true, deliveredQty: true },
    })

    const allDelivered = refreshedItems.every((item) => item.deliveredQty >= item.quantity)

    await tx.salesOrder.update({
      where: { id: salesOrder.id },
      data: { status: allDelivered ? "SHIPPED" : "PROCESSING" },
    })

    return created
  })

  revalidatePath("/sales")
  revalidatePath("/inventory")

  return { success: true, deliveryOrder }
}

export async function createInvoiceFromSalesOrder(salesOrderId: string) {
  assertSalesPrismaDelegates()

  const { user, organization } = await requireCurrentOrganization()

  if (!hasModulePermission(user, "invoice")) {
    throw new Error("Anda tidak memiliki izin untuk membuat invoice dari sales order.")
  }

  const salesOrder = await prisma.salesOrder.findFirst({
    where: { id: salesOrderId, organizationId: organization.id },
    include: {
      customer: true,
      items: {
        include: {
          item: { select: { code: true, name: true } },
        },
      },
      commission: true,
    },
  })

  if (!salesOrder) {
    throw new Error("Sales order tidak ditemukan.")
  }

  const existing = await prisma.invoice.findFirst({
    where: {
      organizationId: organization.id,
      notes: { contains: `AUTO_FROM_SO:${salesOrder.code}` },
    },
  })

  if (existing) {
    return { success: true, invoice: existing, reused: true }
  }

  const customerPaymentTerm = Number(salesOrder.customer.paymentTerm || 30)
  const invoiceDate = new Date()
  const dueDate = new Date(invoiceDate)
  dueDate.setDate(dueDate.getDate() + customerPaymentTerm)

  let invoiceNumber = `INV-${salesOrder.code}`
  const samePrefixCount = await prisma.invoice.count({
    where: { organizationId: organization.id, invoiceNumber: { startsWith: invoiceNumber } },
  })
  if (samePrefixCount > 0) {
    invoiceNumber = `${invoiceNumber}-${samePrefixCount + 1}`
  }

  const subtotal = salesOrder.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
  const taxAmount = salesOrder.items.reduce((sum, item) => sum + item.taxAmount, 0)
  const discountAmount = salesOrder.items.reduce((sum, item) => sum + item.discountAmount, 0)
  const totalAmount = salesOrder.items.reduce((sum, item) => sum + item.totalPrice, 0)

  const invoice = await prisma.$transaction(async (tx) => {
    const created = await tx.invoice.create({
      data: {
        organizationId: organization.id,
        customerId: salesOrder.customerId,
        invoiceNumber,
        invoiceDate,
        dueDate,
        subtotal,
        taxAmount,
        discountAmount,
        totalAmount,
        paidAmount: 0,
        remainingAmount: totalAmount,
        status: "SENT",
        notes: `AUTO_FROM_SO:${salesOrder.code}`,
      },
    })

    await tx.invoiceItem.createMany({
      data: salesOrder.items.map((item) => ({
        invoiceId: created.id,
        description: `${item.item.code} - ${item.item.name}`,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discountAmount,
        taxRate: item.taxPercent,
        subtotal: item.quantity * item.unitPrice,
        taxAmount: item.taxAmount,
        total: item.totalPrice,
      })),
    })

    if (salesOrder.commission && salesOrder.commission.status === "PENDING") {
      await tx.salesCommission.update({
        where: { id: salesOrder.commission.id },
        data: { status: "APPROVED", approvedAt: new Date(), approvedBy: user.id },
      })
    }

    await tx.salesOrder.update({
      where: { id: salesOrder.id },
      data: { status: "DELIVERED" },
    })

    return created
  })

  revalidatePath("/sales")
  revalidatePath("/arap")

  return { success: true, invoice, reused: false }
}

export async function updateSalesCommissionStatus(data: {
  commissionId: string
  status: "PENDING" | "APPROVED" | "PAID" | "CANCELLED"
  bonusAmount?: number
  paymentRef?: string
  notes?: string
}) {
  assertSalesPrismaDelegates()

  const { user } = await requireCurrentOrganization()

  if (!hasModulePermission(user, "commission")) {
    throw new Error("Anda tidak memiliki izin mengubah komisi sales.")
  }

  const current = await prisma.salesCommission.findUnique({ where: { id: data.commissionId } })
  if (!current) {
    throw new Error("Data komisi tidak ditemukan.")
  }

  const bonusAmount = Number(data.bonusAmount ?? current.bonusAmount)
  const totalCommission = current.commissionAmount + bonusAmount

  const updated = await prisma.salesCommission.update({
    where: { id: data.commissionId },
    data: {
      status: data.status,
      bonusAmount,
      totalCommission,
      paymentRef: data.paymentRef ?? current.paymentRef,
      notes: data.notes ?? current.notes,
      approvedAt: data.status === "APPROVED" ? new Date() : current.approvedAt,
      approvedBy: data.status === "APPROVED" ? user.id : current.approvedBy,
      paidAt: data.status === "PAID" ? new Date() : current.paidAt,
    },
  })

  revalidatePath("/sales")
  return { success: true, commission: updated }
}

export async function getSalesReportSummary(startDate?: string, endDate?: string) {
  assertSalesPrismaDelegates()

  const { organization } = await requireCurrentOrganization()

  const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const end = endDate ? new Date(endDate) : new Date()

  const [salesOrders, deliveryOrders, invoices, commissions] = await Promise.all([
    prisma.salesOrder.findMany({
      where: {
        organizationId: organization.id,
        orderDate: { gte: start, lte: end },
      },
      include: {
        customer: { select: { name: true } },
        salesPerson: { select: { name: true } },
      },
      orderBy: { orderDate: "desc" },
    }),
    prisma.deliveryOrder.findMany({
      where: {
        organizationId: organization.id,
        deliveryDate: { gte: start, lte: end },
      },
      include: {
        customer: { select: { name: true } },
        salesOrder: { select: { code: true } },
      },
      orderBy: { deliveryDate: "desc" },
    }),
    prisma.invoice.findMany({
      where: {
        organizationId: organization.id,
        invoiceDate: { gte: start, lte: end },
        OR: [{ invoiceNumber: { startsWith: "INV-SO-" } }, { notes: { contains: "AUTO_FROM_SO:" } }],
      },
      include: {
        customer: { select: { name: true } },
      },
      orderBy: { invoiceDate: "desc" },
    }),
    prisma.salesCommission.findMany({
      where: {
        organizationId: organization.id,
        createdAt: { gte: start, lte: end },
      },
      include: {
        salesPerson: { select: { name: true } },
        salesOrder: { select: { code: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ])

  return {
    start,
    end,
    salesOrders,
    deliveryOrders,
    invoices,
    commissions,
    totals: {
      salesOrderCount: salesOrders.length,
      salesOrderAmount: salesOrders.reduce((sum, row) => sum + row.totalAmount, 0),
      deliveryOrderCount: deliveryOrders.length,
      invoiceCount: invoices.length,
      invoiceAmount: invoices.reduce((sum, row) => sum + row.totalAmount, 0),
      commissionAmount: commissions.reduce((sum, row) => sum + row.totalCommission, 0),
    },
  }
}
