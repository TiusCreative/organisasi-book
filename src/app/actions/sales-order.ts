"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
// Import auth sesuai standar pada blueprint
import { requireWritableModuleAccess, requireModuleAccess } from "@/lib/auth"; 
import { postInventoryMovementInTx } from "@/lib/inventory-ledger";
import { createJournalInTx } from "@/lib/accounting/journal";

/**
 * Membuat Draft Sales Order baru
 */
export async function createSalesOrderDraft(data: {
  organizationId: string;
  customerId: string;
  items: Array<{ itemId: string; quantity: number; unitPrice: number; taxRate?: number }>;
  notes?: string;
  commissionRate?: number;
}) {
  // 1. Validasi akses RBAC (Write) ke Modul Penjualan
  const session = await requireWritableModuleAccess("SALES", data.organizationId);

  try {
    // 2. Kalkulasi Subtotal dan PPN secara rinci
    let subtotal = 0;
    let taxAmount = 0;
    
    const processedItems = data.items.map(item => {
      const lineSubtotal = item.quantity * item.unitPrice;
      const taxRate = item.taxRate || 0;
      const lineTax = lineSubtotal * (taxRate / 100);
      
      subtotal += lineSubtotal;
      taxAmount += lineTax;

      return {
        itemId: item.itemId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxPercent: taxRate,
        taxAmount: lineTax,
        totalPrice: lineSubtotal + lineTax,
      };
    });
    
    const totalAmount = subtotal + taxAmount;

    // 3. Simpan SO secara atomik (header + detail/lines) sebagai DRAFT
    const code = `SO-${Date.now()}`;
    const salesOrder = await prisma.$transaction(async (tx) => {
      const so = await tx.salesOrder.create({
        data: {
          organizationId: data.organizationId,
          customerId: data.customerId,
          code,
          status: "DRAFT",
          subtotal: subtotal,
          taxAmount: taxAmount,
          totalAmount,
          notes: data.notes,
          salesPersonId: session.user.id,
          items: {
            create: processedItems,
          },
        },
      });

      // Jika ada rate komisi, otomatis buat data komisi untuk Sales Person
      if (data.commissionRate && data.commissionRate > 0) {
        const commissionAmount = subtotal * (data.commissionRate / 100);
        await tx.salesCommission.create({
          data: {
            organizationId: data.organizationId,
            salesOrderId: so.id,
            salesPersonId: session.user.id,
            baseAmount: subtotal,
            commissionRate: data.commissionRate / 100,
            commissionAmount: commissionAmount,
            totalCommission: commissionAmount,
            status: "PENDING"
          }
        });
      }
      return so;
    });

    revalidatePath(`/organization/${data.organizationId}/sales`);
    return { success: true, data: salesOrder };
  } catch (error) {
    console.error("Error creating Sales Order:", error);
    return { success: false, error: "Gagal membuat draf Sales Order." };
  }
}

/**
 * Meminta Approval untuk Sales Order DRAFT
 */
export async function requestSalesOrderApproval(soId: string, organizationId: string) {
  // User butuh akses update di modul SALES
  const session = await requireWritableModuleAccess("SALES", organizationId);

  try {
    // Update SO menjadi menungggu approval
    const updatedSo = await prisma.salesOrder.update({
      where: { id: soId, organizationId },
      data: { status: "PENDING_APPROVAL" },
    });

    // Panggil helper pembuat Request Approval generic (jika lib-nya sdh disiapkan sesuai BP)
    // await createApprovalRequest({ referenceType: "SALES_ORDER", referenceId: soId, ... });

    revalidatePath(`/organization/${organizationId}/sales`);
    return { success: true, data: updatedSo };
  } catch (error) {
    console.error("Error requesting SO approval:", error);
    return { success: false, error: "Gagal mengajukan persetujuan." };
  }
}

/**
 * Menyetujui Sales Order
 */
export async function approveSalesOrder(soId: string, organizationId: string) {
  // Hanya bisa diapprove oleh User dengan spesifik role di modul Penjualan (Opsional: Validasi Role Approver)
  const session = await requireWritableModuleAccess("SALES", organizationId);

  try {
    // Eksekusi status ke APPROVED
    const updatedSo = await prisma.salesOrder.update({
      where: { id: soId, organizationId },
      data: { status: "APPROVED" },
    });

    // Catat log keputusan approval
    // await processApprovalDecision({ referenceType: "SALES_ORDER", referenceId: soId, ... });

    revalidatePath(`/organization/${organizationId}/sales`);
    return { success: true, data: updatedSo };
  } catch (error) {
    console.error("Error approving SO:", error);
    return { success: false, error: "Gagal menyetujui Sales Order." };
  }
}

/**
 * Membuat Pengiriman (Delivery Order) - Memotong Stok
 */
export async function deliverSalesOrder(soId: string, organizationId: string, fromWarehouseId: string) {
  const session = await requireWritableModuleAccess("SALES", organizationId);

  try {
    await prisma.$transaction(async (tx) => {
      const so = await tx.salesOrder.findFirst({
        where: { id: soId, organizationId },
        include: { items: true },
      });
      if (!so) throw new Error("Sales Order tidak ditemukan.");
      if (so.status !== "APPROVED") throw new Error("Status SO belum disetujui.");

      // 1. Buat Delivery Order
      const doCode = `DO-${Date.now()}`;
      const deliveryOrder = await tx.deliveryOrder.create({
        data: {
          organizationId,
          salesOrderId: so.id,
          customerId: so.customerId,
          code: doCode,
          status: "SHIPPED",
          shippedAt: new Date(),
          items: {
            create: so.items.map(item => ({
              salesOrderItemId: item.id,
              itemId: item.itemId,
              quantity: item.quantity, // Deliver penuh untuk case sederhana
            }))
          }
        }
      });

      // 2. Pemotongan Stok Inventori (OUT) + Update qty terkirim di SO
      for (const item of so.items) {
        await postInventoryMovementInTx(tx, {
          organizationId,
          itemId: item.itemId,
          movementType: "OUT",
          quantity: item.quantity,
          reference: doCode,
          description: `Pengiriman Delivery Order ${doCode} untuk SO ${so.code}`,
          fromWarehouseId: fromWarehouseId,
          performedBy: session.user.id,
        });

        await tx.salesOrderItem.update({
          where: { id: item.id },
          data: { deliveredQty: item.quantity }
        });
      }

      // 3. Update status SO
      await tx.salesOrder.update({
        where: { id: so.id },
        data: { status: "SHIPPED" }
      });
    });

    revalidatePath(`/organization/${organizationId}/sales`);
    return { success: true };
  } catch (error: any) {
    console.error("Error creating DO:", error);
    return { success: false, error: error.message || "Gagal membuat Delivery Order." };
  }
}

/**
 * Membuat Penagihan (Sales Invoice) - Otomasi Jurnal
 */
export async function createSalesInvoice(
  soId: string, 
  organizationId: string,
  accountIds: { piutangAccountId: string; pendapatanAccountId: string; ppnAccountId?: string }
) {
  const session = await requireWritableModuleAccess("SALES", organizationId);

  try {
    await prisma.$transaction(async (tx) => {
      const so = await tx.salesOrder.findFirst({
        where: { id: soId, organizationId },
        include: { items: true },
      });
      if (!so) throw new Error("Sales Order tidak ditemukan.");

      // 1. Buat Invoice
      const invNumber = `INV-${Date.now()}`;
      const invoice = await tx.invoice.create({
        data: {
          organizationId,
          customerId: so.customerId,
          invoiceNumber: invNumber,
          invoiceDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Term 30 hari default
          subtotal: so.subtotal,
          taxAmount: so.taxAmount,
          discountAmount: so.discountAmount,
          totalAmount: so.totalAmount,
          remainingAmount: so.totalAmount,
          status: "SENT",
          items: {
            create: so.items.map(item => ({
              description: `Barang dari SO ${so.code}`,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.totalPrice,
              taxAmount: item.taxAmount,
              total: item.totalPrice,
            }))
          }
        }
      });
      
      // 2. Otomasi Jurnal (Integrasi COA)
      const piutangAccount = await tx.chartOfAccount.findFirst({
        where: { id: accountIds.piutangAccountId }
      });
      const pendapatanAccount = await tx.chartOfAccount.findFirst({
        where: { id: accountIds.pendapatanAccountId }
      });
      const ppnAccount = accountIds.ppnAccountId ? await tx.chartOfAccount.findFirst({
        where: { id: accountIds.ppnAccountId }
      }) : null;

      if (!piutangAccount || !pendapatanAccount) {
        throw new Error("Akun 'Piutang' atau 'Pendapatan' tidak valid.");
      }

      const dppAmount = Number(so.subtotal) - Number(so.discountAmount);
      const lines = [
        { accountId: piutangAccount.id, debit: Number(so.totalAmount), credit: 0, description: `Piutang Invoice ${invNumber}` },
        { accountId: pendapatanAccount.id, debit: 0, credit: dppAmount, description: `Pendapatan Invoice ${invNumber}` }
      ];

      if (Number(so.taxAmount) > 0 && ppnAccount) {
        lines.push({ accountId: ppnAccount.id, debit: 0, credit: Number(so.taxAmount), description: `PPN Keluaran Invoice ${invNumber}` });
      }

      await createJournalInTx(tx, {
        organizationId,
        date: new Date(),
        description: `Penagihan Penjualan otomatis untuk SO ${so.code}`,
        reference: invNumber,
        lines
      });
      
      // Update SO Status ke INVOICED
      await tx.salesOrder.update({ where: { id: so.id }, data: { status: "INVOICED" } });
    });

    revalidatePath(`/organization/${organizationId}/sales`);
    return { success: true };
  } catch (error: any) {
    console.error("Error creating Invoice:", error);
    return { success: false, error: error.message || "Gagal membuat Invoice." };
  }
}

/**
 * Mengambil Data Pendukung untuk Sales Manager UI
 */
export async function getSalesManagerData(organizationId: string) {
  const session = await requireModuleAccess("sales");
  
  const [salesOrders, customers, warehouses, inventoryItems, accounts] = await Promise.all([
    prisma.salesOrder.findMany({
      where: { organizationId },
      include: { customer: true, items: { include: { item: true } } },
      orderBy: { createdAt: "desc" }
    }),
    prisma.customer.findMany({ where: { organizationId, status: "ACTIVE" } }),
    prisma.warehouse.findMany({ where: { organizationId, status: "ACTIVE" } }),
    prisma.inventoryItem.findMany({ where: { organizationId, status: "ACTIVE" } }),
    prisma.chartOfAccount.findMany({
      where: { organizationId },
      orderBy: { code: "asc" }
    })
  ]);

  return { success: true, salesOrders, customers, warehouses, inventoryItems, accounts };
}