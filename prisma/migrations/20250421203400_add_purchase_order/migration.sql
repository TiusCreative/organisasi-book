-- Add PurchaseOrder and PurchaseOrderItem models
-- Add relation to Organization
ALTER TABLE "Organization" ADD COLUMN "purchaseOrders" TEXT;

-- Add relation to Supplier
ALTER TABLE "Supplier" ADD COLUMN "purchaseOrders" TEXT;

-- Create PurchaseOrder table
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PurchaseOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Create PurchaseOrderItem table
CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
);

-- Create indexes
CREATE INDEX "PurchaseOrder_organizationId_idx" ON "PurchaseOrder"("organizationId");
CREATE INDEX "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");
CREATE INDEX "PurchaseOrder_poNumber_idx" ON "PurchaseOrder"("poNumber");
CREATE INDEX "PurchaseOrderItem_purchaseOrderId_idx" ON "PurchaseOrderItem"("purchaseOrderId");

-- Drop the added text columns (they were placeholders for the relation)
ALTER TABLE "Organization" DROP COLUMN "purchaseOrders";
ALTER TABLE "Supplier" DROP COLUMN "purchaseOrders";
