"use server"

import type { UserRole } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { requireModuleAccess, requireWritableModuleAccess } from "@/lib/auth"
import { createApprovalRequestInTx, getPendingApprovalRequestByEntityInTx, resolveApprovalRequestInTx } from "@/lib/approval-workflow"
import { revalidatePath } from "next/cache"
import { postInventoryMovementInTx } from "@/lib/inventory-ledger"
import { createJournalInTx } from "@/lib/accounting/journal"

type PurchaseOrderItemInput = {
  itemId?: string
  description: string
  quantity: number | string
  unitPrice: number | string
  discount?: number | string
  taxRate?: number | string
}

function assertApproverRole(role: UserRole) {
  if (role !== "ADMIN" && role !== "MANAGER") {
    throw new Error("Hanya ADMIN/MANAGER yang bisa menyetujui/menolak.")
  }
}

export async function createPurchaseOrder(formData: FormData) {
  const { organization } = await requireWritableModuleAccess("arap")

  const supplierId = formData.get("supplierId") as string
  const orderDate = new Date(formData.get("orderDate") as string)
  const expectedDate = formData.get("expectedDate") ? new Date(formData.get("expectedDate") as string) : null
  const notes = formData.get("notes") as string | null
  const itemsJson = formData.get("items") as string

  const items = JSON.parse(itemsJson) as PurchaseOrderItemInput[]

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

  const calculatedItems = items.map((item) => {
    const quantity = Number(item.quantity || 0)
    const unitPrice = Number(item.unitPrice || 0)
    const discount = Number(item.discount || 0)
    const taxRate = Number(item.taxRate ?? 0)

    const itemSubtotal = quantity * unitPrice
    const itemDiscount = itemSubtotal * (discount / 100)
    const itemTax = (itemSubtotal - itemDiscount) * (taxRate / 100)
    const itemTotal = itemSubtotal - itemDiscount + itemTax

    subtotal += itemSubtotal
    discountAmount += itemDiscount
    taxAmount += itemTax

    return {
      ...item,
      quantity,
      unitPrice,
      discount,
      taxRate,
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
        create: calculatedItems.map((item) => ({
          itemId: item.itemId || null,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          taxRate: item.taxRate,
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
  const { organization } = await requireWritableModuleAccess("arap")

  const id = formData.get("id") as string
  const status = formData.get("status") as string

  const current = await prisma.purchaseOrder.findFirst({
    where: { id, organizationId: organization.id },
    select: { id: true, status: true },
  })
  if (!current) {
    throw new Error("Purchase Order tidak ditemukan.")
  }

  if (status === "SENT" && current.status !== "APPROVED") {
    throw new Error("PO harus disetujui (APPROVED) sebelum dikirim (SENT).")
  }

  const po = await prisma.purchaseOrder.update({
    where: { id },
    data: { status },
  })

  revalidatePath("/po")
  revalidatePath("/arap")
  return { success: true, po }
}

export async function submitPurchaseOrderForApproval(poId: string) {
  const { organization, user } = await requireWritableModuleAccess("arap")

  await prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findFirst({
      where: { id: poId, organizationId: organization.id },
      select: { id: true, status: true },
    })
    if (!po) throw new Error("Purchase Order tidak ditemukan.")
    if (po.status !== "DRAFT") throw new Error("Hanya PO DRAFT yang bisa diajukan approval.")

    await createApprovalRequestInTx(tx, {
      organizationId: organization.id,
      entityType: "PurchaseOrder",
      entityId: po.id,
      requestedBy: user.id,
    })

    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: { status: "PENDING_APPROVAL" },
    })
  })

  revalidatePath("/po")
  revalidatePath("/arap")
  return { success: true }
}

export async function approvePurchaseOrder(poId: string, note?: string) {
  const { organization, user } = await requireModuleAccess("arap")
  assertApproverRole(user.role)

  await prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findFirst({
      where: { id: poId, organizationId: organization.id },
      select: { id: true, status: true },
    })
    if (!po) throw new Error("Purchase Order tidak ditemukan.")
    if (po.status !== "PENDING_APPROVAL") throw new Error("PO tidak dalam status PENDING_APPROVAL.")

    const req = await getPendingApprovalRequestByEntityInTx(tx, {
      organizationId: organization.id,
      entityType: "PurchaseOrder",
      entityId: po.id,
    })
    if (!req) throw new Error("Approval request tidak ditemukan.")

    await resolveApprovalRequestInTx(tx, {
      requestId: req.id,
      decision: "APPROVE",
      decidedBy: user.id,
      note: note || null,
    })

    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: { status: "APPROVED" },
    })
  })

  revalidatePath("/po")
  revalidatePath("/arap")
  return { success: true }
}

export async function rejectPurchaseOrder(poId: string, note?: string) {
  const { organization, user } = await requireModuleAccess("arap")
  assertApproverRole(user.role)

  await prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findFirst({
      where: { id: poId, organizationId: organization.id },
      select: { id: true, status: true },
    })
    if (!po) throw new Error("Purchase Order tidak ditemukan.")
    if (po.status !== "PENDING_APPROVAL") throw new Error("PO tidak dalam status PENDING_APPROVAL.")

    const req = await getPendingApprovalRequestByEntityInTx(tx, {
      organizationId: organization.id,
      entityType: "PurchaseOrder",
      entityId: po.id,
    })
    if (!req) throw new Error("Approval request tidak ditemukan.")

    await resolveApprovalRequestInTx(tx, {
      requestId: req.id,
      decision: "REJECT",
      decidedBy: user.id,
      note: note || null,
    })

    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: { status: "REJECTED" },
    })
  })

  revalidatePath("/po")
  revalidatePath("/arap")
  return { success: true }
}

export async function getPurchaseOrders() {
  const { organization } = await requireModuleAccess("arap")

  const pos = await prisma.purchaseOrder.findMany({
    where: { organizationId: organization.id },
    include: { supplier: true, items: true },
    orderBy: { orderDate: "desc" },
  })

  return { success: true, purchaseOrders: pos }
}

export async function getPurchaseOrderById(id: string) {
  const { organization } = await requireModuleAccess("arap")

  const po = await prisma.purchaseOrder.findFirst({
    where: { id, organizationId: organization.id },
    include: { supplier: true, items: true },
  })

  if (!po) {
    throw new Error("Purchase Order tidak ditemukan")
  }

  return { success: true, po }
}

export async function receivePurchaseOrder(
  poId: string, 
  receivedItems: Array<{ poItemId: string; quantity: number; warehouseId: string }>,
  landedCostData?: { amount: number; method: 'QUANTITY' | 'VALUE' }
) {
  // Validasi RBAC untuk penerimaan barang ke gudang
  const { organization, user } = await requireWritableModuleAccess("warehouse")

  await prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findFirst({
      where: { id: poId, organizationId: organization.id },
      include: { items: true },
    })

    if (!po) throw new Error("Purchase Order tidak ditemukan.")
    if (!["APPROVED", "SENT", "PARTIALLY_RECEIVED"].includes(po.status)) {
      throw new Error("Status PO tidak valid untuk penerimaan barang.")
    }

    // 1. Hitung Total Qty dan Total Value untuk dasar proporsi Landed Cost
    let totalQtyReceived = 0
    let totalValueReceived = 0
    const itemsToProcess = receivedItems.map((receipt) => {
      const item = po.items.find((i) => i.id === receipt.poItemId)
      if (!item) throw new Error(`Item PO dengan ID ${receipt.poItemId} tidak ditemukan.`)
      
      const receivedQty = Number(receipt.quantity)
      const unitPrice = Number(item.unitPrice)
      
      totalQtyReceived += receivedQty
      totalValueReceived += (receivedQty * unitPrice)
      return { receipt, item, receivedQty, unitPrice }
    })

    // Variabel akumulasi untuk Jurnal Akuntansi
    let totalInventoryDebit = 0
    let totalGrniCredit = 0

    for (const { receipt, item, receivedQty, unitPrice } of itemsToProcess) {
      if (!item.itemId) throw new Error(`Item "${item.description}" tidak memiliki relasi ke Master Barang (InventoryItem).`)

      if (receivedQty <= 0) throw new Error(`Kuantitas penerimaan untuk "${item.description}" harus lebih dari 0.`)

      // Update qty diterima di PO Item
      const newReceivedQty = Number(item.receivedQty) + receivedQty
      if (newReceivedQty > Number(item.quantity)) {
        throw new Error(`Kuantitas penerimaan total melebihi pesanan untuk item "${item.description}".`)
      }

      await tx.purchaseOrderItem.update({
        where: { id: item.id },
        data: { receivedQty: newReceivedQty },
      })
      
      // 2. Alokasi Landed Cost ke Item ini
      let allocatedCost = 0
      if (landedCostData && landedCostData.amount > 0) {
        if (landedCostData.method === 'QUANTITY' && totalQtyReceived > 0) {
          allocatedCost = (receivedQty / totalQtyReceived) * landedCostData.amount
        } else if (landedCostData.method === 'VALUE' && totalValueReceived > 0) {
          const itemValue = receivedQty * unitPrice
          allocatedCost = (itemValue / totalValueReceived) * landedCostData.amount
        }
      }

      // HPP Unit Cost final (Harga Asli + Proporsi Biaya Tambahan)
      const additionalCostPerUnit = receivedQty > 0 ? (allocatedCost / receivedQty) : 0
      const finalUnitCost = unitPrice + additionalCostPerUnit
      
      // Akumulasi Jurnal
      const inventoryItemValue = receivedQty * finalUnitCost
      const grniItemValue = receivedQty * unitPrice
      totalInventoryDebit += inventoryItemValue
      totalGrniCredit += grniItemValue

      // Buat mutasi persediaan masuk (IN) ke Gudang (Warehouse) melalui Immutable Ledger
      await postInventoryMovementInTx(tx, {
        organizationId: organization.id,
        itemId: item.itemId,
        movementType: "IN",
        quantity: receivedQty,
        unitCost: finalUnitCost, // Menggunakan HPP yang sudah menyerap Landed Cost
        reference: po.poNumber,
        description: `Penerimaan barang dari PO ${po.poNumber}`,
        toWarehouseId: receipt.warehouseId,
        performedBy: user.id,
      })
    }

    // Cek apakah semua item sudah diterima penuh
    const updatedItems = await tx.purchaseOrderItem.findMany({
      where: { purchaseOrderId: po.id },
    })

    const isFullyReceived = updatedItems.every((i) => Number(i.receivedQty) >= Number(i.quantity))

    // Update status PO
    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: { status: isFullyReceived ? "RECEIVED" : "PARTIALLY_RECEIVED" },
    })
    
    // 3. Create Accounting Journal In Transaction (Otomatis)
    const accConfig = await tx.accountingConfig.findUnique({
      where: { organizationId: organization.id }
    })

    if (!accConfig?.inventoryAccountId) {
      throw new Error("Akun Persediaan belum diatur di Pengaturan Akuntansi.")
    }

    const landedCostAmount = landedCostData?.amount || 0
    const lines = [
      { accountId: accConfig.inventoryAccountId, debit: totalInventoryDebit, credit: 0, description: `Persediaan dari PO ${po.poNumber}` },
      { accountId: accConfig.inventoryAccountId, debit: 0, credit: totalGrniCredit, description: `GRNI untuk PO ${po.poNumber}` }
    ]

    // Jika ada landed cost, kredit ke akun biaya ekspedisi (gunakan akun persediaan sebagai fallback)
    if (landedCostAmount > 0) {
      lines.push({ accountId: accConfig.inventoryAccountId, debit: 0, credit: landedCostAmount, description: `Biaya Landed Cost PO ${po.poNumber}` })
    }

    await createJournalInTx(tx, {
      organizationId: organization.id,
      date: new Date(),
      reference: po.poNumber,
      description: `GRN untuk PO ${po.poNumber}`,
      lines
    })
  })

  revalidatePath("/po")
  revalidatePath("/inventory")
  return { success: true }
}
