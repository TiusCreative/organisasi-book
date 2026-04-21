import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST() {
  try {
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `
    const tableNames = tables.map(t => t.tablename)

    const requiredTables = [
      'Customer', 'Supplier', 'Invoice', 'InvoiceItem', 'InvoicePayment',
      'VendorBill', 'VendorBillItem', 'VendorBillPayment',
      'PurchaseOrder', 'PurchaseOrderItem'
    ]
    const missingTables = requiredTables.filter(t => !tableNames.includes(t))

    if (missingTables.length === 0) {
      return NextResponse.json({ success: true, message: "All tables already exist" })
    }

    // Drop existing incomplete tables in reverse dependency order
    const tablesToDrop = [
      'PurchaseOrderItem', 'PurchaseOrder',
      'VendorBillPayment', 'VendorBillItem', 'VendorBill',
      'InvoicePayment', 'InvoiceItem', 'Invoice',
      'Supplier', 'Customer'
    ]
    for (const table of tablesToDrop) {
      if (tableNames.includes(table)) {
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${table}" CASCADE`)
      }
    }

    // Create Customer table matching Prisma schema
    await prisma.$executeRaw`CREATE TABLE "Customer" (
      "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      "organizationId" TEXT NOT NULL,
      "code" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "email" TEXT,
      "phone" TEXT,
      "address" TEXT,
      "city" TEXT,
      "npwp" TEXT,
      "creditLimit" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "paymentTerm" INTEGER NOT NULL DEFAULT 30,
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`
    await prisma.$executeRaw`CREATE UNIQUE INDEX "Customer_organizationId_code_key" ON "Customer"("organizationId", "code")`
    await prisma.$executeRaw`CREATE INDEX "Customer_organizationId_status_idx" ON "Customer"("organizationId", "status")`

    // Create Supplier table matching Prisma schema
    await prisma.$executeRaw`CREATE TABLE "Supplier" (
      "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      "organizationId" TEXT NOT NULL,
      "code" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "email" TEXT,
      "phone" TEXT,
      "address" TEXT,
      "city" TEXT,
      "npwp" TEXT,
      "bankAccount" TEXT,
      "bankName" TEXT,
      "paymentTerm" INTEGER NOT NULL DEFAULT 30,
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Supplier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`
    await prisma.$executeRaw`CREATE UNIQUE INDEX "Supplier_organizationId_code_key" ON "Supplier"("organizationId", "code")`
    await prisma.$executeRaw`CREATE INDEX "Supplier_organizationId_status_idx" ON "Supplier"("organizationId", "status")`

    // Create Invoice table matching Prisma schema
    await prisma.$executeRaw`CREATE TABLE "Invoice" (
      "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      "organizationId" TEXT NOT NULL,
      "customerId" TEXT NOT NULL,
      "invoiceNumber" TEXT NOT NULL,
      "invoiceDate" TIMESTAMP(3) NOT NULL,
      "dueDate" TIMESTAMP(3) NOT NULL,
      "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "remainingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "status" TEXT NOT NULL DEFAULT 'DRAFT',
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )`
    await prisma.$executeRaw`CREATE UNIQUE INDEX "Invoice_organizationId_invoiceNumber_key" ON "Invoice"("organizationId", "invoiceNumber")`
    await prisma.$executeRaw`CREATE INDEX "Invoice_organizationId_customerId_idx" ON "Invoice"("organizationId", "customerId")`
    await prisma.$executeRaw`CREATE INDEX "Invoice_organizationId_status_idx" ON "Invoice"("organizationId", "status")`
    await prisma.$executeRaw`CREATE INDEX "Invoice_organizationId_invoiceDate_idx" ON "Invoice"("organizationId", "invoiceDate")`

    // Create InvoiceItem table
    await prisma.$executeRaw`CREATE TABLE "InvoiceItem" (
      "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      "invoiceId" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
      "unitPrice" DOUBLE PRECISION NOT NULL,
      "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "subtotal" DOUBLE PRECISION NOT NULL,
      "taxAmount" DOUBLE PRECISION NOT NULL,
      "total" DOUBLE PRECISION NOT NULL,
      CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`

    // Create InvoicePayment table
    await prisma.$executeRaw`CREATE TABLE "InvoicePayment" (
      "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      "organizationId" TEXT NOT NULL,
      "invoiceId" TEXT NOT NULL,
      "paymentDate" TIMESTAMP(3) NOT NULL,
      "amount" DOUBLE PRECISION NOT NULL,
      "paymentMethod" TEXT NOT NULL,
      "bankAccountId" TEXT,
      "referenceNumber" TEXT,
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "InvoicePayment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "InvoicePayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`
    await prisma.$executeRaw`CREATE INDEX "InvoicePayment_organizationId_invoiceId_idx" ON "InvoicePayment"("organizationId", "invoiceId")`
    await prisma.$executeRaw`CREATE INDEX "InvoicePayment_organizationId_paymentDate_idx" ON "InvoicePayment"("organizationId", "paymentDate")`

    // Create VendorBill table matching Prisma schema
    await prisma.$executeRaw`CREATE TABLE "VendorBill" (
      "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      "organizationId" TEXT NOT NULL,
      "supplierId" TEXT NOT NULL,
      "billNumber" TEXT NOT NULL,
      "billDate" TIMESTAMP(3) NOT NULL,
      "dueDate" TIMESTAMP(3) NOT NULL,
      "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "remainingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "status" TEXT NOT NULL DEFAULT 'DRAFT',
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "VendorBill_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "VendorBill_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )`
    await prisma.$executeRaw`CREATE UNIQUE INDEX "VendorBill_organizationId_billNumber_key" ON "VendorBill"("organizationId", "billNumber")`
    await prisma.$executeRaw`CREATE INDEX "VendorBill_organizationId_supplierId_idx" ON "VendorBill"("organizationId", "supplierId")`
    await prisma.$executeRaw`CREATE INDEX "VendorBill_organizationId_status_idx" ON "VendorBill"("organizationId", "status")`
    await prisma.$executeRaw`CREATE INDEX "VendorBill_organizationId_billDate_idx" ON "VendorBill"("organizationId", "billDate")`

    // Create VendorBillItem table
    await prisma.$executeRaw`CREATE TABLE "VendorBillItem" (
      "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      "vendorBillId" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
      "unitPrice" DOUBLE PRECISION NOT NULL,
      "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "subtotal" DOUBLE PRECISION NOT NULL,
      "taxAmount" DOUBLE PRECISION NOT NULL,
      "total" DOUBLE PRECISION NOT NULL,
      CONSTRAINT "VendorBillItem_vendorBillId_fkey" FOREIGN KEY ("vendorBillId") REFERENCES "VendorBill"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`

    // Create VendorBillPayment table
    await prisma.$executeRaw`CREATE TABLE "VendorBillPayment" (
      "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      "organizationId" TEXT NOT NULL,
      "vendorBillId" TEXT NOT NULL,
      "paymentDate" TIMESTAMP(3) NOT NULL,
      "amount" DOUBLE PRECISION NOT NULL,
      "paymentMethod" TEXT NOT NULL,
      "bankAccountId" TEXT,
      "referenceNumber" TEXT,
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "VendorBillPayment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "VendorBillPayment_vendorBillId_fkey" FOREIGN KEY ("vendorBillId") REFERENCES "VendorBill"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`
    await prisma.$executeRaw`CREATE INDEX "VendorBillPayment_organizationId_vendorBillId_idx" ON "VendorBillPayment"("organizationId", "vendorBillId")`
    await prisma.$executeRaw`CREATE INDEX "VendorBillPayment_organizationId_paymentDate_idx" ON "VendorBillPayment"("organizationId", "paymentDate")`

    // Create PurchaseOrder table matching Prisma schema
    await prisma.$executeRaw`CREATE TABLE "PurchaseOrder" (
      "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      "organizationId" TEXT NOT NULL,
      "supplierId" TEXT NOT NULL,
      "poNumber" TEXT NOT NULL UNIQUE,
      "orderDate" TIMESTAMP(3) NOT NULL,
      "expectedDate" TIMESTAMP(3),
      "status" TEXT NOT NULL DEFAULT 'DRAFT',
      "subtotal" DECIMAL(20,2) NOT NULL,
      "taxAmount" DECIMAL(20,2) NOT NULL DEFAULT 0,
      "discountAmount" DECIMAL(20,2) NOT NULL DEFAULT 0,
      "totalAmount" DECIMAL(20,2) NOT NULL,
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PurchaseOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )`
    await prisma.$executeRaw`CREATE INDEX "PurchaseOrder_organizationId_idx" ON "PurchaseOrder"("organizationId")`
    await prisma.$executeRaw`CREATE INDEX "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId")`
    await prisma.$executeRaw`CREATE INDEX "PurchaseOrder_poNumber_idx" ON "PurchaseOrder"("poNumber")`

    // Create PurchaseOrderItem table
    await prisma.$executeRaw`CREATE TABLE "PurchaseOrderItem" (
      "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      "purchaseOrderId" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "quantity" DECIMAL(10,2) NOT NULL,
      "unitPrice" DECIMAL(20,2) NOT NULL,
      "discount" DECIMAL(20,2) NOT NULL DEFAULT 0,
      "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
      "subtotal" DECIMAL(20,2) NOT NULL,
      "taxAmount" DECIMAL(20,2) NOT NULL,
      "total" DECIMAL(20,2) NOT NULL,
      CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`
    await prisma.$executeRaw`CREATE INDEX "PurchaseOrderItem_purchaseOrderId_idx" ON "PurchaseOrderItem"("purchaseOrderId")`

    return NextResponse.json({ success: true, message: "Migration completed successfully" })
  } catch (error) {
    console.error("Migration error:", error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 })
  }
}
