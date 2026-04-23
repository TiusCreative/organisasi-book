"use server"

import { exec } from "child_process"
import { promisify } from "util"
import { readFile, writeFile, mkdir, readdir, stat, unlink } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { prisma } from "../../lib/prisma"
import { requirePlatformAdmin } from "../../lib/auth"

const execAsync = promisify(exec)

// Backup directory
const BACKUP_DIR = path.join(process.cwd(), "backups")

// Ensure backup directory exists
async function ensureBackupDir() {
  if (!existsSync(BACKUP_DIR)) {
    await mkdir(BACKUP_DIR, { recursive: true })
  }
}

// Generate backup filename
function generateBackupFilename(type: "full" | "schema" | "data" = "full") {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  return `backup-${type}-${timestamp}.sql`
}

// Get database URL from environment
function getDatabaseUrl() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error("DATABASE_URL not configured")
  }
  return url
}

// Parse PostgreSQL connection string
function parseConnectionString(url: string) {
  // Handle both standard postgres:// and postgresql:// URLs
  const regex = /postgresql?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/
  const match = url.match(regex)
  
  if (!match) {
    // Try simpler format without port
    const simpleRegex = /postgresql?:\/\/([^:]+):([^@]+)@([^\/]+)\/(.+)/
    const simpleMatch = url.match(simpleRegex)
    if (simpleMatch) {
      return {
        user: simpleMatch[1],
        password: simpleMatch[2],
        host: simpleMatch[3],
        port: "5432",
        database: simpleMatch[4].split("?")[0],
      }
    }
    throw new Error("Invalid database connection string format")
  }
  
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: match[4],
    database: match[5].split("?")[0],
  }
}

// Create full database backup
export async function createFullBackup() {
  await requirePlatformAdmin()
  await ensureBackupDir()
  
  const dbUrl = getDatabaseUrl()
  const conn = parseConnectionString(dbUrl)
  const filename = generateBackupFilename("full")
  const filepath = path.join(BACKUP_DIR, filename)
  
  try {
    // Use pg_dump to create backup
    const command = `PGPASSWORD="${conn.password}" pg_dump -h ${conn.host} -p ${conn.port} -U ${conn.user} -d ${conn.database} -F p -f "${filepath}"`
    
    await execAsync(command, {
      env: { ...process.env, PGPASSWORD: conn.password },
      timeout: 300000, // 5 minutes timeout
    })
    
    // Get file stats
    const stats = await stat(filepath)
    
    return {
      success: true,
      filename,
      size: stats.size,
      createdAt: stats.birthtime.toISOString(),
    }
  } catch (error) {
    console.error("Backup failed:", error)
    // Clean up failed backup file
    try {
      if (existsSync(filepath)) {
        await unlink(filepath)
      }
    } catch {}
    
    throw new Error(`Backup failed: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Create schema-only backup
export async function createSchemaBackup() {
  await requirePlatformAdmin()
  await ensureBackupDir()
  
  const dbUrl = getDatabaseUrl()
  const conn = parseConnectionString(dbUrl)
  const filename = generateBackupFilename("schema")
  const filepath = path.join(BACKUP_DIR, filename)
  
  try {
    // Use pg_dump with --schema-only flag
    const command = `PGPASSWORD="${conn.password}" pg_dump -h ${conn.host} -p ${conn.port} -U ${conn.user} -d ${conn.database} -s -F p -f "${filepath}"`
    
    await execAsync(command, {
      env: { ...process.env, PGPASSWORD: conn.password },
      timeout: 300000,
    })
    
    const stats = await stat(filepath)
    
    return {
      success: true,
      filename,
      size: stats.size,
      createdAt: stats.birthtime.toISOString(),
    }
  } catch (error) {
    console.error("Schema backup failed:", error)
    try {
      if (existsSync(filepath)) {
        await unlink(filepath)
      }
    } catch {}
    
    throw new Error(`Schema backup failed: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Create data-only backup (no schema)
export async function createDataBackup() {
  await requirePlatformAdmin()
  await ensureBackupDir()
  
  const dbUrl = getDatabaseUrl()
  const conn = parseConnectionString(dbUrl)
  const filename = generateBackupFilename("data")
  const filepath = path.join(BACKUP_DIR, filename)
  
  try {
    // Use pg_dump with --data-only flag
    const command = `PGPASSWORD="${conn.password}" pg_dump -h ${conn.host} -p ${conn.port} -U ${conn.user} -d ${conn.database} -a -F p -f "${filepath}"`
    
    await execAsync(command, {
      env: { ...process.env, PGPASSWORD: conn.password },
      timeout: 300000,
    })
    
    const stats = await stat(filepath)
    
    return {
      success: true,
      filename,
      size: stats.size,
      createdAt: stats.birthtime.toISOString(),
    }
  } catch (error) {
    console.error("Data backup failed:", error)
    try {
      if (existsSync(filepath)) {
        await unlink(filepath)
      }
    } catch {}
    
    throw new Error(`Data backup failed: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// List all backups
export async function listBackups() {
  await requirePlatformAdmin()
  await ensureBackupDir()
  
  try {
    const files = await readdir(BACKUP_DIR)
    const backups = await Promise.all(
      files
        .filter(f => f.endsWith(".sql"))
        .map(async (filename) => {
          const filepath = path.join(BACKUP_DIR, filename)
          const stats = await stat(filepath)
          
          // Determine backup type from filename
          let type: "full" | "schema" | "data" = "full"
          if (filename.includes("-schema-")) type = "schema"
          else if (filename.includes("-data-")) type = "data"
          
          return {
            filename,
            type,
            size: stats.size,
            createdAt: stats.birthtime.toISOString(),
          }
        })
    )
    
    // Sort by date descending
    return backups.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  } catch (error) {
    console.error("List backups failed:", error)
    return []
  }
}

// Get backup file content
export async function getBackupContent(filename: string) {
  await requirePlatformAdmin()
  
  // Validate filename to prevent directory traversal
  if (!filename.match(/^backup-(full|schema|data)-[\d\-T]+\.sql$/)) {
    throw new Error("Invalid backup filename")
  }
  
  const filepath = path.join(BACKUP_DIR, filename)
  
  if (!existsSync(filepath)) {
    throw new Error("Backup file not found")
  }
  
  try {
    const content = await readFile(filepath, "utf-8")
    return { success: true, content }
  } catch (error) {
    throw new Error(`Failed to read backup: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Delete backup file
export async function deleteBackup(filename: string) {
  await requirePlatformAdmin()
  
  // Validate filename
  if (!filename.match(/^backup-(full|schema|data)-[\d\-T]+\.sql$/)) {
    throw new Error("Invalid backup filename")
  }
  
  const filepath = path.join(BACKUP_DIR, filename)
  
  if (!existsSync(filepath)) {
    throw new Error("Backup file not found")
  }
  
  try {
    await unlink(filepath)
    return { success: true }
  } catch (error) {
    throw new Error(`Failed to delete backup: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Restore database from backup
export async function restoreBackup(filename: string, options: { 
  dropExisting?: boolean 
  dryRun?: boolean 
} = {}) {
  await requirePlatformAdmin()
  
  // Validate filename
  if (!filename.match(/^backup-(full|schema|data)-[\d\-T]+\.sql$/)) {
    throw new Error("Invalid backup filename")
  }
  
  const filepath = path.join(BACKUP_DIR, filename)
  
  if (!existsSync(filepath)) {
    throw new Error("Backup file not found")
  }
  
  const dbUrl = getDatabaseUrl()
  const conn = parseConnectionString(dbUrl)
  
  try {
    // If dropExisting is true, we need to drop and recreate the database
    if (options.dropExisting && !options.dryRun) {
      // Connect to postgres database to drop target database
      const postgresCommand = `PGPASSWORD="${conn.password}" psql -h ${conn.host} -p ${conn.port} -U ${conn.user} -d postgres -c "DROP DATABASE IF EXISTS \\"${conn.database}\\"; CREATE DATABASE \\"${conn.database}\\";"`
      
      await execAsync(postgresCommand, {
        env: { ...process.env, PGPASSWORD: conn.password },
        timeout: 60000,
      })
    }
    
    if (options.dryRun) {
      // Just validate the backup file
      const content = await readFile(filepath, "utf-8")
      const lineCount = content.split("\n").length
      
      return {
        success: true,
        dryRun: true,
        message: `Backup file valid. ${lineCount} lines ready for restore.`,
      }
    }
    
    // Restore the backup
    const command = `PGPASSWORD="${conn.password}" psql -h ${conn.host} -p ${conn.port} -U ${conn.user} -d ${conn.database} -f "${filepath}"`
    
    const { stdout, stderr } = await execAsync(command, {
      env: { ...process.env, PGPASSWORD: conn.password },
      timeout: 600000, // 10 minutes timeout for restore
    })
    
    return {
      success: true,
      message: "Database restored successfully",
      output: stdout,
      warnings: stderr || null,
    }
  } catch (error) {
    console.error("Restore failed:", error)
    throw new Error(`Restore failed: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Get Prisma schema content
export async function getPrismaSchema() {
  await requirePlatformAdmin()
  
  try {
    const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma")
    const content = await readFile(schemaPath, "utf-8")
    return { success: true, content }
  } catch (error) {
    throw new Error(`Failed to read schema: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Export database as JSON (for granular export)
export async function exportDatabaseAsJson() {
  await requirePlatformAdmin()
  
  try {
    // Export all tables as JSON
    const data = {
      exportDate: new Date().toISOString(),
      tables: {} as Record<string, unknown[]>,
    }
    
    // Get all table names from Prisma
    const tables = [
      "User",
      "Organization",
      "AccountCategory",
      "ChartOfAccount",
      "BankAccount",
      "Investment",
      "Transaction",
      "TransactionLine",
      "Employee",
      "Allowance",
      "Deduction",
      "SalarySlip",
      "TaxEntry",
      "AuditLog",
      "NoteSequence",
      "SubscriptionPayment",
      "PeriodLock",
      "Customer",
      "Supplier",
      "Invoice",
      "InvoiceItem",
      "VendorBill",
      "VendorBillItem",
      "InvoicePayment",
      "VendorBillPayment",
      "PurchaseOrder",
      "PurchaseOrderItem",
      "BankReconciliation",
      "BankReconciliationItem",
      "RecurringTransaction",
      "RecurringTransactionLine",
      "TransactionAttachment",
      "Currency",
      "ExchangeRate",
      "PettyCash",
      "PettyCashTransaction",
      "WorkOrder",
      "WorkOrderItem",
      "WorkOrderMaterialIssue",
      "WorkOrderCostEntry",
      "Warehouse",
      "InventoryItem",
      "InventoryMovement",
      "BillOfMaterial",
      "BillOfMaterialLine",
      "StockOpname",
      "StockOpnameItem",
      "SalesOrder",
      "SalesOrderItem",
      "DeliveryOrder",
      "DeliveryOrderItem",
      "SalesCommission",
      "Branch",
      "Budget",
      "BudgetItem",
      "BudgetActual",
      "Division",
    ]
    
    for (const table of tables) {
      try {
        // @ts-expect-error - Dynamic access to prisma models
        const records = await prisma[table.charAt(0).toLowerCase() + table.slice(1)].findMany({
          take: 10000, // Limit to prevent memory issues
        })
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        data.tables[table] = records
      } catch {
        // Table might not exist or have different naming
        data.tables[table] = []
      }
    }
    
    return { success: true, data }
  } catch (error) {
    throw new Error(`Export failed: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Get database statistics
export async function getDatabaseStats() {
  await requirePlatformAdmin()
  
  try {
    // Get counts for major tables
    const stats = await prisma.$transaction([
      prisma.user.count(),
      prisma.organization.count(),
      prisma.transaction.count(),
      prisma.chartOfAccount.count(),
      prisma.employee.count(),
      prisma.invoice.count(),
      prisma.vendorBill.count(),
      prisma.inventoryItem.count(),
      prisma.salesOrder.count(),
    ])
    
    return {
      success: true,
      stats: {
        users: stats[0],
        organizations: stats[1],
        transactions: stats[2],
        accounts: stats[3],
        employees: stats[4],
        invoices: stats[5],
        vendorBills: stats[6],
        inventoryItems: stats[7],
        salesOrders: stats[8],
      },
    }
  } catch (error) {
    throw new Error(`Failed to get stats: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Generate SQL for Supabase from Prisma schema
export async function generateSupabaseSql() {
  await requirePlatformAdmin()
  
  try {
    // Read Prisma schema
    const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma")
    const schemaContent = await readFile(schemaPath, "utf-8")
    
    // Parse models and generate SQL
    const models: Array<{
      name: string
      fields: Array<{
        name: string
        type: string
        attributes: string[]
        isOptional: boolean
      }>
    }> = []
    
    // Simple regex parsing for models
    const modelRegex = /model\s+(\w+)\s+\{([^}]+)\}/g
    let match
    
    while ((match = modelRegex.exec(schemaContent)) !== null) {
      const modelName = match[1]
      const modelBody = match[2]
      
      const fields: Array<{
        name: string
        type: string
        attributes: string[]
        isOptional: boolean
      }> = []
      
      // Parse fields
      const fieldLines = modelBody.split("\n").filter(line => line.trim() && !line.trim().startsWith("//"))
      
      for (const line of fieldLines) {
        const fieldMatch = line.match(/^\s*(\w+)\s+(\??[\w\[\]]+)(.*)$/)
        if (fieldMatch) {
          const fieldName = fieldMatch[1]
          let fieldType = fieldMatch[2].trim()
          const attributes = fieldMatch[3].trim().split(/\s+/).filter(Boolean)
          
          const isOptional = fieldType.startsWith("?")
          if (isOptional) {
            fieldType = fieldType.slice(1)
          }
          
          fields.push({
            name: fieldName,
            type: fieldType,
            attributes,
            isOptional,
          })
        }
      }
      
      models.push({ name: modelName, fields })
    }
    
    // Generate SQL DDL
    let sql = "-- Generated SQL for Supabase from Prisma Schema\n"
    sql += "-- Generated at: " + new Date().toISOString() + "\n\n"
    sql += "-- Enable necessary extensions\n"
    sql += `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\n\n`
    
    // Generate CREATE TABLE statements
    for (const model of models) {
      if (model.fields.length === 0) continue
      
      sql += `CREATE TABLE IF NOT EXISTS "${model.name}" (\n`
      
      const fieldDefinitions: string[] = []
      
      for (const field of model.fields) {
        let pgType = "TEXT"
        
        // Map Prisma types to PostgreSQL types
        if (field.type === "String") pgType = "TEXT"
        else if (field.type === "Int") pgType = "INTEGER"
        else if (field.type === "Float" || field.type === "Decimal") pgType = "DOUBLE PRECISION"
        else if (field.type === "Boolean") pgType = "BOOLEAN"
        else if (field.type === "DateTime") pgType = "TIMESTAMP WITH TIME ZONE"
        else if (field.type === "Json") pgType = "JSONB"
        else if (field.type === "Bytes") pgType = "BYTEA"
        else if (field.type === "String[]") pgType = "TEXT[]"
        
        let definition = `  "${field.name}" ${pgType}`
        
        // Handle attributes
        if (field.attributes.includes("@id")) {
          definition += " PRIMARY KEY"
        }
        if (field.attributes.includes("@unique")) {
          definition += " UNIQUE"
        }
        if (field.attributes.includes("@default(uuid())") || field.attributes.includes("@default(cuid())")) {
          definition += " DEFAULT gen_random_uuid()"
        } else if (field.attributes.some(a => a.includes("@default(now())"))) {
          definition += " DEFAULT CURRENT_TIMESTAMP"
        }
        if (!field.isOptional && !field.attributes.includes("@id")) {
          definition += " NOT NULL"
        }
        
        fieldDefinitions.push(definition)
      }
      
      sql += fieldDefinitions.join(",\n")
      sql += "\n);\n\n"
    }
    
    return { success: true, sql, models }
  } catch (error) {
    throw new Error(`Failed to generate SQL: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Download backup file (returns base64 content)
export async function downloadBackup(filename: string) {
  await requirePlatformAdmin()
  
  // Validate filename
  if (!filename.match(/^backup-(full|schema|data)-[\d\-T]+\.sql$/)) {
    throw new Error("Invalid backup filename")
  }
  
  const filepath = path.join(BACKUP_DIR, filename)
  
  if (!existsSync(filepath)) {
    throw new Error("Backup file not found")
  }
  
  try {
    const content = await readFile(filepath)
    const base64 = Buffer.from(content).toString("base64")
    
    return {
      success: true,
      filename,
      content: base64,
      contentType: "application/sql",
    }
  } catch (error) {
    throw new Error(`Failed to read backup: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Upload and restore from SQL content
export async function uploadAndRestore(base64Content: string, options: {
  dropExisting?: boolean
} = {}) {
  await requirePlatformAdmin()
  
  try {
    // Decode base64 content
    const sqlContent = Buffer.from(base64Content, "base64").toString("utf-8")
    
    // Validate SQL content
    if (!sqlContent.trim().toLowerCase().includes("create") && 
        !sqlContent.trim().toLowerCase().includes("insert")) {
      throw new Error("Invalid SQL content")
    }
    
    // Save to temp file
    const tempFilename = `upload-${Date.now()}.sql`
    const tempPath = path.join(BACKUP_DIR, tempFilename)
    await writeFile(tempPath, sqlContent)
    
    // Restore from temp file
    const result = await restoreBackup(tempFilename, options)
    
    // Clean up temp file
    try {
      await unlink(tempPath)
    } catch {}
    
    return result
  } catch (error) {
    throw new Error(`Upload and restore failed: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}
