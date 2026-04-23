import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ensureWorkOrderHppSchema } from "@/lib/work-order-schema"
import { ensureInventorySecuritySchema } from "@/lib/inventory-security-schema"
import { ensureOutboxSchema } from "@/lib/outbox-schema"
import { ensureWarehouseReadModelSchema } from "@/lib/warehouse-read-model"
import { ensureWarehouseEnterpriseSchema } from "@/lib/warehouse-enterprise-schema"
import { ensureStockBalanceSchema } from "@/lib/stock-balance-schema"

export async function POST() {
  try {
    await Promise.all([
      ensureWorkOrderHppSchema(),
      ensureInventorySecuritySchema(),
      ensureOutboxSchema(),
      ensureWarehouseReadModelSchema(),
      ensureWarehouseEnterpriseSchema(),
      ensureStockBalanceSchema(),
    ])

    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `
    const tableNames = tables.map(t => t.tablename)

    // Create Currency table if missing
    if (!tableNames.includes('Currency')) {
      await prisma.$executeRawUnsafe(`CREATE TABLE "Currency" ("id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(), "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "symbol" TEXT, "decimalPlaces" INTEGER NOT NULL DEFAULT 2, "isBase" BOOLEAN NOT NULL DEFAULT false, "isDefault" BOOLEAN NOT NULL DEFAULT false, "exchangeRate" DOUBLE PRECISION, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Currency_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE)`)
      await prisma.$executeRaw`CREATE UNIQUE INDEX "Currency_organizationId_code_key" ON "Currency"("organizationId", "code")`
      await prisma.$executeRaw`CREATE INDEX "Currency_organizationId_idx" ON "Currency"("organizationId")`
    } else {
      // Add isBase column if missing
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "Currency" ADD COLUMN "isBase" BOOLEAN NOT NULL DEFAULT false`)
      } catch {
        // Column may already exist
      }
      // Add isActive column if missing
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "Currency" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true`)
      } catch {
        // Column may already exist
      }
    }

    // Create ExchangeRate table if missing
    if (!tableNames.includes('ExchangeRate')) {
      await prisma.$executeRawUnsafe(`CREATE TABLE "ExchangeRate" ("id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(), "organizationId" TEXT NOT NULL, "fromCurrencyId" TEXT NOT NULL, "toCurrencyId" TEXT NOT NULL, "rate" DOUBLE PRECISION NOT NULL, "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ExchangeRate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "ExchangeRate_fromCurrencyId_fkey" FOREIGN KEY ("fromCurrencyId") REFERENCES "Currency"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "ExchangeRate_toCurrencyId_fkey" FOREIGN KEY ("toCurrencyId") REFERENCES "Currency"("id") ON DELETE CASCADE ON UPDATE CASCADE)`)
      await prisma.$executeRaw`CREATE INDEX "ExchangeRate_organizationId_idx" ON "ExchangeRate"("organizationId")`
      await prisma.$executeRaw`CREATE INDEX "ExchangeRate_fromCurrencyId_idx" ON "ExchangeRate"("fromCurrencyId")`
      await prisma.$executeRaw`CREATE INDEX "ExchangeRate_toCurrencyId_idx" ON "ExchangeRate"("toCurrencyId")`
    }

    // Create PettyCash table if missing
    if (!tableNames.includes('PettyCash')) {
      await prisma.$executeRawUnsafe(`CREATE TABLE "PettyCash" ("id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(), "organizationId" TEXT NOT NULL, "name" TEXT NOT NULL, "code" TEXT NOT NULL, "currencyId" TEXT NOT NULL, "fundType" TEXT NOT NULL, "initialAmount" DOUBLE PRECISION NOT NULL DEFAULT 0, "currentAmount" DOUBLE PRECISION NOT NULL DEFAULT 0, "custodianId" TEXT, "location" TEXT, "status" TEXT NOT NULL DEFAULT 'ACTIVE', "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PettyCash_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "PettyCash_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "PettyCash_custodianId_fkey" FOREIGN KEY ("custodianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE)`)
      await prisma.$executeRaw`CREATE UNIQUE INDEX "PettyCash_organizationId_code_key" ON "PettyCash"("organizationId", "code")`
      await prisma.$executeRaw`CREATE INDEX "PettyCash_organizationId_idx" ON "PettyCash"("organizationId")`
      await prisma.$executeRaw`CREATE INDEX "PettyCash_custodianId_idx" ON "PettyCash"("custodianId")`
    } else {
      // Add missing columns to existing table
      const columnsToAdd = [
        { name: 'name', type: 'TEXT' },
        { name: 'code', type: 'TEXT' },
        { name: 'currencyId', type: 'TEXT' },
        { name: 'fundType', type: 'TEXT' },
        { name: 'initialAmount', type: 'DOUBLE PRECISION DEFAULT 0' },
        { name: 'currentAmount', type: 'DOUBLE PRECISION DEFAULT 0' },
        { name: 'custodianId', type: 'TEXT' },
        { name: 'location', type: 'TEXT' },
        { name: 'notes', type: 'TEXT' }
      ]
      for (const col of columnsToAdd) {
        try {
          await prisma.$executeRawUnsafe(`ALTER TABLE "PettyCash" ADD COLUMN "${col.name}" ${col.type}`)
        } catch {
          // Column may already exist
        }
      }
      // Add foreign key constraint for currencyId
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "PettyCash" ADD CONSTRAINT "PettyCash_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE CASCADE ON UPDATE CASCADE`)
      } catch {
        // Constraint may already exist
      }
      // Add foreign key constraint for custodianId
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "PettyCash" ADD CONSTRAINT "PettyCash_custodianId_fkey" FOREIGN KEY ("custodianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE`)
      } catch {
        // Constraint may already exist
      }
      // Copy fundName to name if name is null
      try {
        await prisma.$executeRawUnsafe(`UPDATE "PettyCash" SET "name" = "fundName" WHERE "name" IS NULL AND "fundName" IS NOT NULL`)
      } catch {
        // Ignore error
      }
    }

    // Create PettyCashTransaction table if missing
    if (!tableNames.includes('PettyCashTransaction')) {
      await prisma.$executeRawUnsafe(`CREATE TABLE "PettyCashTransaction" ("id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(), "pettyCashId" TEXT NOT NULL, "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "type" TEXT NOT NULL, "amount" DOUBLE PRECISION NOT NULL, "description" TEXT, "category" TEXT, "receiptNumber" TEXT, "approvedBy" TEXT, "documentUrl" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PettyCashTransaction_pettyCashId_fkey" FOREIGN KEY ("pettyCashId") REFERENCES "PettyCash"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "PettyCashTransaction_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE)`)
      await prisma.$executeRaw`CREATE INDEX "PettyCashTransaction_pettyCashId_idx" ON "PettyCashTransaction"("pettyCashId")`
      await prisma.$executeRaw`CREATE INDEX "PettyCashTransaction_date_idx" ON "PettyCashTransaction"("date")`
      await prisma.$executeRaw`CREATE INDEX "PettyCashTransaction_type_idx" ON "PettyCashTransaction"("type")`
    }

    // Create SalesOrder table if missing
    if (!tableNames.includes('SalesOrder')) {
      await prisma.$executeRawUnsafe(`CREATE TABLE "SalesOrder" ("id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(), "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "customerId" TEXT NOT NULL, "salesPersonId" TEXT, "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "deliveryDate" TIMESTAMP(3), "status" TEXT NOT NULL DEFAULT 'DRAFT', "priority" TEXT NOT NULL DEFAULT 'NORMAL', "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0, "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0, "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0, "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0, "notes" TEXT, "terms" TEXT, "internalNotes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "SalesOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "SalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "SalesOrder_salesPersonId_fkey" FOREIGN KEY ("salesPersonId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE)`)
      await prisma.$executeRaw`CREATE UNIQUE INDEX "SalesOrder_organizationId_code_key" ON "SalesOrder"("organizationId", "code")`
      await prisma.$executeRaw`CREATE INDEX "SalesOrder_organizationId_idx" ON "SalesOrder"("organizationId")`
      await prisma.$executeRaw`CREATE INDEX "SalesOrder_status_idx" ON "SalesOrder"("status")`
      await prisma.$executeRaw`CREATE INDEX "SalesOrder_customerId_idx" ON "SalesOrder"("customerId")`
      await prisma.$executeRaw`CREATE INDEX "SalesOrder_salesPersonId_idx" ON "SalesOrder"("salesPersonId")`
    }

    // Create SalesOrderItem table if missing
    if (!tableNames.includes('SalesOrderItem')) {
      await prisma.$executeRawUnsafe(`CREATE TABLE "SalesOrderItem" ("id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(), "salesOrderId" TEXT NOT NULL, "itemId" TEXT NOT NULL, "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0, "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0, "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0, "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0, "taxPercent" DOUBLE PRECISION NOT NULL DEFAULT 0, "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0, "totalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0, "notes" TEXT, "deliveredQty" DOUBLE PRECISION NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "SalesOrderItem_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "SalesOrderItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE)`)
      await prisma.$executeRaw`CREATE INDEX "SalesOrderItem_salesOrderId_idx" ON "SalesOrderItem"("salesOrderId")`
      await prisma.$executeRaw`CREATE INDEX "SalesOrderItem_itemId_idx" ON "SalesOrderItem"("itemId")`
    }

    // Create DeliveryOrder table if missing
    if (!tableNames.includes('DeliveryOrder')) {
      await prisma.$executeRawUnsafe(`CREATE TABLE "DeliveryOrder" ("id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(), "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "salesOrderId" TEXT NOT NULL, "customerId" TEXT NOT NULL, "deliveryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "status" TEXT NOT NULL DEFAULT 'DRAFT', "driverName" TEXT, "driverPhone" TEXT, "vehiclePlate" TEXT, "deliveryAddress" TEXT, "notes" TEXT, "trackingNumber" TEXT, "shippedAt" TIMESTAMP(3), "deliveredAt" TIMESTAMP(3), "receivedBy" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "DeliveryOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "DeliveryOrder_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "DeliveryOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE)`)
      await prisma.$executeRaw`CREATE UNIQUE INDEX "DeliveryOrder_organizationId_code_key" ON "DeliveryOrder"("organizationId", "code")`
      await prisma.$executeRaw`CREATE INDEX "DeliveryOrder_organizationId_idx" ON "DeliveryOrder"("organizationId")`
      await prisma.$executeRaw`CREATE INDEX "DeliveryOrder_status_idx" ON "DeliveryOrder"("status")`
      await prisma.$executeRaw`CREATE INDEX "DeliveryOrder_salesOrderId_idx" ON "DeliveryOrder"("salesOrderId")`
      await prisma.$executeRaw`CREATE INDEX "DeliveryOrder_customerId_idx" ON "DeliveryOrder"("customerId")`
    }

    // Create DeliveryOrderItem table if missing
    if (!tableNames.includes('DeliveryOrderItem')) {
      await prisma.$executeRawUnsafe(`CREATE TABLE "DeliveryOrderItem" ("id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(), "deliveryOrderId" TEXT NOT NULL, "salesOrderItemId" TEXT NOT NULL, "itemId" TEXT NOT NULL, "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0, "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "DeliveryOrderItem_deliveryOrderId_fkey" FOREIGN KEY ("deliveryOrderId") REFERENCES "DeliveryOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "DeliveryOrderItem_salesOrderItemId_fkey" FOREIGN KEY ("salesOrderItemId") REFERENCES "SalesOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "DeliveryOrderItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE)`)
      await prisma.$executeRaw`CREATE INDEX "DeliveryOrderItem_deliveryOrderId_idx" ON "DeliveryOrderItem"("deliveryOrderId")`
      await prisma.$executeRaw`CREATE INDEX "DeliveryOrderItem_salesOrderItemId_idx" ON "DeliveryOrderItem"("salesOrderItemId")`
      await prisma.$executeRaw`CREATE INDEX "DeliveryOrderItem_itemId_idx" ON "DeliveryOrderItem"("itemId")`
    }

    // Create SalesCommission table if missing
    if (!tableNames.includes('SalesCommission')) {
      await prisma.$executeRawUnsafe(`CREATE TABLE "SalesCommission" ("id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(), "organizationId" TEXT NOT NULL, "salesOrderId" TEXT NOT NULL, "salesPersonId" TEXT NOT NULL, "baseAmount" DOUBLE PRECISION NOT NULL DEFAULT 0, "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0, "commissionAmount" DOUBLE PRECISION NOT NULL DEFAULT 0, "bonusAmount" DOUBLE PRECISION NOT NULL DEFAULT 0, "totalCommission" DOUBLE PRECISION NOT NULL DEFAULT 0, "status" TEXT NOT NULL DEFAULT 'PENDING', "approvedBy" TEXT, "approvedAt" TIMESTAMP(3), "paidAt" TIMESTAMP(3), "paymentRef" TEXT, "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "SalesCommission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "SalesCommission_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "SalesCommission_salesPersonId_fkey" FOREIGN KEY ("salesPersonId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE)`)
      await prisma.$executeRaw`CREATE UNIQUE INDEX "SalesCommission_salesOrderId_key" ON "SalesCommission"("salesOrderId")`
      await prisma.$executeRaw`CREATE INDEX "SalesCommission_organizationId_idx" ON "SalesCommission"("organizationId")`
      await prisma.$executeRaw`CREATE INDEX "SalesCommission_status_idx" ON "SalesCommission"("status")`
      await prisma.$executeRaw`CREATE INDEX "SalesCommission_salesPersonId_idx" ON "SalesCommission"("salesPersonId")`
    }

    // Add columns to Customer table
    if (tableNames.includes('Customer')) {
      const customerColumns = [
        { name: 'contactPerson', type: 'TEXT' },
        { name: 'mobile', type: 'TEXT' },
        { name: 'province', type: 'TEXT' },
        { name: 'postalCode', type: 'TEXT' },
        { name: 'country', type: 'TEXT DEFAULT \'Indonesia\'' }
      ]
      for (const col of customerColumns) {
        try {
          await prisma.$executeRawUnsafe(`ALTER TABLE "Customer" ADD COLUMN "${col.name}" ${col.type}`)
        } catch {
          // Column may already exist
        }
      }
    }

    // Add columns to Supplier table
    if (tableNames.includes('Supplier')) {
      const supplierColumns = [
        { name: 'contactPerson', type: 'TEXT' },
        { name: 'mobile', type: 'TEXT' },
        { name: 'province', type: 'TEXT' },
        { name: 'postalCode', type: 'TEXT' },
        { name: 'country', type: 'TEXT DEFAULT \'Indonesia\'' }
      ]
      for (const col of supplierColumns) {
        try {
          await prisma.$executeRawUnsafe(`ALTER TABLE "Supplier" ADD COLUMN "${col.name}" ${col.type}`)
        } catch {
          // Column may already exist
        }
      }
    }

    // Create Branch table if missing
    if (!tableNames.includes('Branch')) {
      await prisma.$executeRawUnsafe(`CREATE TABLE "Branch" ("id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(), "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "address" TEXT, "city" TEXT, "province" TEXT, "postalCode" TEXT, "country" TEXT DEFAULT 'Indonesia', "phone" TEXT, "email" TEXT, "managerId" TEXT, "warehouseId" TEXT, "status" TEXT NOT NULL DEFAULT 'ACTIVE', "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Branch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "Branch_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE, CONSTRAINT "Branch_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE)`)
      await prisma.$executeRaw`CREATE UNIQUE INDEX "Branch_organizationId_code_key" ON "Branch"("organizationId", "code")`
      await prisma.$executeRaw`CREATE INDEX "Branch_organizationId_idx" ON "Branch"("organizationId")`
      await prisma.$executeRaw`CREATE INDEX "Branch_status_idx" ON "Branch"("status")`
      await prisma.$executeRaw`CREATE INDEX "Branch_managerId_idx" ON "Branch"("managerId")`
    }

    // Add columns to InventoryItem table for warehouse management features
    if (tableNames.includes('InventoryItem')) {
      const inventoryItemColumns = [
        { name: 'itemType', type: 'TEXT DEFAULT \'GENERAL\'' },
        { name: 'secondaryUnit', type: 'TEXT' },
        { name: 'conversionRate', type: 'DOUBLE PRECISION DEFAULT 1' },
        { name: 'shelf', type: 'TEXT' },
        { name: 'row', type: 'TEXT' },
        { name: 'level', type: 'TEXT' },
        { name: 'bin', type: 'TEXT' },
        { name: 'reorderPoint', type: 'DOUBLE PRECISION DEFAULT 0' },
        { name: 'safetyStock', type: 'DOUBLE PRECISION DEFAULT 0' }
      ]
      for (const col of inventoryItemColumns) {
        try {
          await prisma.$executeRawUnsafe(`ALTER TABLE "InventoryItem" ADD COLUMN "${col.name}" ${col.type}`)
        } catch {
          // Column may already exist
        }
      }
      // Create index for shelf location
      try {
        await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "InventoryItem_shelf_row_level_idx" ON "InventoryItem"("shelf", "row", "level")`
      } catch {
        // Index may already exist
      }
      try {
        await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "InventoryItem_itemType_idx" ON "InventoryItem"("itemType")`
      } catch {
        // Index may already exist
      }
    }

    // Add columns to StockOpname table for approval and sync
    if (tableNames.includes('StockOpname')) {
      const stockOpnameColumns = [
        { name: 'approvedBy', type: 'TEXT' },
        { name: 'approvedAt', type: 'TIMESTAMP(3)' },
        { name: 'syncedAt', type: 'TIMESTAMP(3)' },
        { name: 'isSynced', type: 'BOOLEAN DEFAULT false' }
      ]
      for (const col of stockOpnameColumns) {
        try {
          await prisma.$executeRawUnsafe(`ALTER TABLE "StockOpname" ADD COLUMN "${col.name}" ${col.type}`)
        } catch {
          // Column may already exist
        }
      }
      // Add foreign key constraint for approvedBy
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "StockOpname" ADD CONSTRAINT "StockOpname_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE`)
      } catch {
        // Constraint may already exist
      }
      // Create indexes
      try {
        await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "StockOpname_performedBy_idx" ON "StockOpname"("performedBy")`
      } catch {
        // Index may already exist
      }
      try {
        await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "StockOpname_approvedBy_idx" ON "StockOpname"("approvedBy")`
      } catch {
        // Index may already exist
      }
    }

    // Create Budget table if missing
    if (!tableNames.includes('Budget')) {
      await prisma.$executeRawUnsafe(`CREATE TABLE "Budget" ("id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(), "organizationId" TEXT NOT NULL, "year" INTEGER NOT NULL, "divisionId" TEXT, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "periodType" TEXT NOT NULL DEFAULT 'ANNUAL', "status" TEXT NOT NULL DEFAULT 'DRAFT', "totalBudget" DOUBLE PRECISION NOT NULL DEFAULT 0, "totalActual" DOUBLE PRECISION NOT NULL DEFAULT 0, "variance" DOUBLE PRECISION NOT NULL DEFAULT 0, "variancePercent" DOUBLE PRECISION NOT NULL DEFAULT 0, "approvedBy" TEXT, "approvedAt" TIMESTAMP(3), "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Budget_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "Budget_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "ChartOfAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE, CONSTRAINT "Budget_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE)`)
      await prisma.$executeRaw`CREATE UNIQUE INDEX "Budget_organizationId_code_key" ON "Budget"("organizationId", "code")`
      await prisma.$executeRaw`CREATE UNIQUE INDEX "Budget_organizationId_year_divisionId_key" ON "Budget"("organizationId", "year", "divisionId")`
      await prisma.$executeRaw`CREATE INDEX "Budget_organizationId_idx" ON "Budget"("organizationId")`
      await prisma.$executeRaw`CREATE INDEX "Budget_year_idx" ON "Budget"("year")`
      await prisma.$executeRaw`CREATE INDEX "Budget_divisionId_idx" ON "Budget"("divisionId")`
      await prisma.$executeRaw`CREATE INDEX "Budget_status_idx" ON "Budget"("status")`
    }

    // Create BudgetItem table if missing
    if (!tableNames.includes('BudgetItem')) {
      await prisma.$executeRawUnsafe(`CREATE TABLE "BudgetItem" ("id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(), "budgetId" TEXT NOT NULL, "accountId" TEXT, "category" TEXT, "itemName" TEXT NOT NULL, "budgetAmount" DOUBLE PRECISION NOT NULL DEFAULT 0, "actualAmount" DOUBLE PRECISION NOT NULL DEFAULT 0, "variance" DOUBLE PRECISION NOT NULL DEFAULT 0, "variancePercent" DOUBLE PRECISION NOT NULL DEFAULT 0, "q1Budget" DOUBLE PRECISION NOT NULL DEFAULT 0, "q1Actual" DOUBLE PRECISION NOT NULL DEFAULT 0, "q2Budget" DOUBLE PRECISION NOT NULL DEFAULT 0, "q2Actual" DOUBLE PRECISION NOT NULL DEFAULT 0, "q3Budget" DOUBLE PRECISION NOT NULL DEFAULT 0, "q3Actual" DOUBLE PRECISION NOT NULL DEFAULT 0, "q4Budget" DOUBLE PRECISION NOT NULL DEFAULT 0, "q4Actual" DOUBLE PRECISION NOT NULL DEFAULT 0, "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "BudgetItem_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "BudgetItem_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ChartOfAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE)`)
      await prisma.$executeRaw`CREATE INDEX "BudgetItem_budgetId_idx" ON "BudgetItem"("budgetId")`
      await prisma.$executeRaw`CREATE INDEX "BudgetItem_accountId_idx" ON "BudgetItem"("accountId")`
      await prisma.$executeRaw`CREATE INDEX "BudgetItem_category_idx" ON "BudgetItem"("category")`
    }

    // Create BudgetActual table if missing
    if (!tableNames.includes('BudgetActual')) {
      await prisma.$executeRawUnsafe(`CREATE TABLE "BudgetActual" ("id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(), "budgetId" TEXT NOT NULL, "budgetItemId" TEXT, "transactionId" TEXT, "period" TEXT, "actualAmount" DOUBLE PRECISION NOT NULL DEFAULT 0, "budgetAmount" DOUBLE PRECISION NOT NULL DEFAULT 0, "variance" DOUBLE PRECISION NOT NULL DEFAULT 0, "variancePercent" DOUBLE PRECISION NOT NULL DEFAULT 0, "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "BudgetActual_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "BudgetActual_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "BudgetItem"("id") ON DELETE SET NULL ON UPDATE CASCADE)`)
      await prisma.$executeRaw`CREATE INDEX "BudgetActual_budgetId_idx" ON "BudgetActual"("budgetId")`
      await prisma.$executeRaw`CREATE INDEX "BudgetActual_budgetItemId_idx" ON "BudgetActual"("budgetItemId")`
      await prisma.$executeRaw`CREATE INDEX "BudgetActual_period_idx" ON "BudgetActual"("period")`
      await prisma.$executeRaw`CREATE INDEX "BudgetActual_transactionId_idx" ON "BudgetActual"("transactionId")`
    }

    // Create Division table if missing
    if (!tableNames.includes('Division')) {
      await prisma.$executeRawUnsafe(`CREATE TABLE "Division" ("id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(), "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "parentId" TEXT, "managerId" TEXT, "description" TEXT, "status" TEXT NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Division_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "Division_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Division"("id") ON DELETE SET NULL ON UPDATE CASCADE, CONSTRAINT "Division_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE)`)
      await prisma.$executeRaw`CREATE UNIQUE INDEX "Division_organizationId_code_key" ON "Division"("organizationId", "code")`
      await prisma.$executeRaw`CREATE INDEX "Division_organizationId_idx" ON "Division"("organizationId")`
      await prisma.$executeRaw`CREATE INDEX "Division_parentId_idx" ON "Division"("parentId")`
      await prisma.$executeRaw`CREATE INDEX "Division_managerId_idx" ON "Division"("managerId")`
      await prisma.$executeRaw`CREATE INDEX "Division_status_idx" ON "Division"("status")`
    }

    // Add currencyId column to BankAccount if missing (always run this first)
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "BankAccount" ADD COLUMN "currencyId" TEXT`)
    } catch {
      // Column may already exist
    }
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE SET NULL ON UPDATE CASCADE`)
    } catch {
      // Constraint may already exist
    }

    const requiredTables = ['WorkOrder', 'WorkOrderItem', 'Warehouse', 'InventoryItem', 'InventoryMovement', 'StockOpname', 'StockOpnameItem']
    const missingTables = requiredTables.filter(t => !tableNames.includes(t))

    if (missingTables.length === 0) {
      await ensureWorkOrderHppSchema()
      await ensureInventorySecuritySchema()
      return NextResponse.json({ success: true, message: "Migration completed successfully" })
    }

    if (missingTables.includes('WorkOrder')) {
      await prisma.$executeRawUnsafe(`CREATE TABLE "WorkOrder" ("id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(), "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "barcode" TEXT, "title" TEXT NOT NULL, "description" TEXT, "customerId" TEXT, "status" TEXT NOT NULL DEFAULT 'PENDING', "priority" TEXT NOT NULL DEFAULT 'MEDIUM', "assignedTo" TEXT, "startDate" TIMESTAMP(3), "dueDate" TIMESTAMP(3), "completedAt" TIMESTAMP(3), "estimatedHours" DOUBLE PRECISION, "actualHours" DOUBLE PRECISION, "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "WorkOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "WorkOrder_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE, CONSTRAINT "WorkOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE)`)
      await prisma.$executeRaw`CREATE UNIQUE INDEX "WorkOrder_organizationId_code_key" ON "WorkOrder"("organizationId", "code")`
      await prisma.$executeRaw`CREATE INDEX "WorkOrder_organizationId_idx" ON "WorkOrder"("organizationId")`
      await prisma.$executeRaw`CREATE INDEX "WorkOrder_status_idx" ON "WorkOrder"("status")`
    }

    if (missingTables.includes('WorkOrderItem')) {
      await prisma.$executeRawUnsafe(`CREATE TABLE "WorkOrderItem" ("id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(), "workOrderId" TEXT NOT NULL, "itemId" TEXT, "description" TEXT NOT NULL, "quantity" DOUBLE PRECISION NOT NULL, "unit" TEXT, "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0, "totalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0, "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "WorkOrderItem_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE)`)
      await prisma.$executeRaw`CREATE INDEX "WorkOrderItem_workOrderId_idx" ON "WorkOrderItem"("workOrderId")`
    }

    if (missingTables.includes('Warehouse')) {
      await prisma.$executeRawUnsafe(`CREATE TABLE "Warehouse" ("id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(), "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "location" TEXT, "type" TEXT NOT NULL DEFAULT 'MAIN', "managerId" TEXT, "status" TEXT NOT NULL DEFAULT 'ACTIVE', "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Warehouse_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "Warehouse_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE)`)
      await prisma.$executeRaw`CREATE UNIQUE INDEX "Warehouse_organizationId_code_key" ON "Warehouse"("organizationId", "code")`
      await prisma.$executeRaw`CREATE INDEX "Warehouse_organizationId_idx" ON "Warehouse"("organizationId")`
      await prisma.$executeRaw`CREATE INDEX "Warehouse_status_idx" ON "Warehouse"("status")`
    }

    if (missingTables.includes('InventoryItem')) {
      await prisma.$executeRawUnsafe(`CREATE TABLE "InventoryItem" ("id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(), "organizationId" TEXT NOT NULL, "warehouseId" TEXT NOT NULL, "code" TEXT NOT NULL, "barcode" TEXT, "name" TEXT NOT NULL, "description" TEXT, "category" TEXT, "unit" TEXT NOT NULL, "valuationMethod" TEXT NOT NULL DEFAULT 'AVERAGE', "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0, "minStock" DOUBLE PRECISION NOT NULL DEFAULT 0, "maxStock" DOUBLE PRECISION, "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0, "totalValue" DOUBLE PRECISION NOT NULL DEFAULT 0, "status" TEXT NOT NULL DEFAULT 'ACTIVE', "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "InventoryItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "InventoryItem_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE)`)
      await prisma.$executeRaw`CREATE UNIQUE INDEX "InventoryItem_organizationId_warehouseId_code_key" ON "InventoryItem"("organizationId", "warehouseId", "code")`
      await prisma.$executeRaw`CREATE INDEX "InventoryItem_organizationId_idx" ON "InventoryItem"("organizationId")`
      await prisma.$executeRaw`CREATE INDEX "InventoryItem_warehouseId_idx" ON "InventoryItem"("warehouseId")`
      await prisma.$executeRaw`CREATE INDEX "InventoryItem_barcode_idx" ON "InventoryItem"("barcode")`
      await prisma.$executeRaw`CREATE INDEX "InventoryItem_category_idx" ON "InventoryItem"("category")`
    }

    if (missingTables.includes('InventoryMovement')) {
      await prisma.$executeRawUnsafe(`CREATE TABLE "InventoryMovement" ("id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(), "organizationId" TEXT NOT NULL, "itemId" TEXT NOT NULL, "movementType" TEXT NOT NULL, "quantity" DOUBLE PRECISION NOT NULL, "unitCost" DOUBLE PRECISION, "totalCost" DOUBLE PRECISION, "reference" TEXT, "description" TEXT, "fromWarehouseId" TEXT, "toWarehouseId" TEXT, "performedBy" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "InventoryMovement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "InventoryMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE)`)
      await prisma.$executeRaw`CREATE INDEX "InventoryMovement_organizationId_idx" ON "InventoryMovement"("organizationId")`
      await prisma.$executeRaw`CREATE INDEX "InventoryMovement_itemId_idx" ON "InventoryMovement"("itemId")`
      await prisma.$executeRaw`CREATE INDEX "InventoryMovement_movementType_idx" ON "InventoryMovement"("movementType")`
      await prisma.$executeRaw`CREATE INDEX "InventoryMovement_createdAt_idx" ON "InventoryMovement"("createdAt")`
    }

    if (missingTables.includes('StockOpname')) {
      await prisma.$executeRawUnsafe(`CREATE TABLE "StockOpname" ("id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(), "organizationId" TEXT NOT NULL, "warehouseId" TEXT NOT NULL, "code" TEXT NOT NULL, "opnameDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "status" TEXT NOT NULL DEFAULT 'DRAFT', "performedBy" TEXT, "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "StockOpname_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "StockOpname_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE)`)
      await prisma.$executeRaw`CREATE UNIQUE INDEX "StockOpname_organizationId_code_key" ON "StockOpname"("organizationId", "code")`
      await prisma.$executeRaw`CREATE INDEX "StockOpname_organizationId_idx" ON "StockOpname"("organizationId")`
      await prisma.$executeRaw`CREATE INDEX "StockOpname_warehouseId_idx" ON "StockOpname"("warehouseId")`
      await prisma.$executeRaw`CREATE INDEX "StockOpname_opnameDate_idx" ON "StockOpname"("opnameDate")`
      await prisma.$executeRaw`CREATE INDEX "StockOpname_status_idx" ON "StockOpname"("status")`
    }

    if (missingTables.includes('StockOpnameItem')) {
      await prisma.$executeRawUnsafe(`CREATE TABLE "StockOpnameItem" ("id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(), "stockOpnameId" TEXT NOT NULL, "itemId" TEXT NOT NULL, "systemQuantity" DOUBLE PRECISION NOT NULL, "physicalQuantity" DOUBLE PRECISION NOT NULL, "difference" DOUBLE PRECISION NOT NULL, "unitCost" DOUBLE PRECISION, "totalDifference" DOUBLE PRECISION, "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "StockOpnameItem_stockOpnameId_fkey" FOREIGN KEY ("stockOpnameId") REFERENCES "StockOpname"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "StockOpnameItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE)`)
      await prisma.$executeRaw`CREATE INDEX "StockOpnameItem_stockOpnameId_idx" ON "StockOpnameItem"("stockOpnameId")`
      await prisma.$executeRaw`CREATE INDEX "StockOpnameItem_itemId_idx" ON "StockOpnameItem"("itemId")`
    }

    await ensureWorkOrderHppSchema()
    await ensureInventorySecuritySchema()
    return NextResponse.json({ success: true, message: "Migration completed successfully" })
  } catch (error) {
    console.error("Migration error:", error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}
