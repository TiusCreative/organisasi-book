import type { User, UserRole } from "@prisma/client"

export const MODULE_PERMISSION_LABELS = {
  dashboard: "Dashboard",
  transactions: "Transaksi",
  bank: "Rekening Bank",
  investments: "Investasi",
  hrga: "HR & GA",
  payroll: "Payroll (HR)",
  reports: "Laporan (Umum)",
  // Laporan Keuangan
  reportFinancial: "Laporan Keuangan",
  balanceSheet: "Laporan Neraca",
  incomeStatement: "Laporan Laba Rugi",
  cashFlow: "Laporan Arus Kas",
  equityChange: "Laporan Perubahan Modal",
  retainedEarnings: "Laporan Laba Ditahan",
  reservesDistribution: "Laporan Cadangan & Distribusi",
  generalLedger: "Buku Besar",
  businessCombination: "Kombinasi Bisnis",
  consolidatedStatements: "Laporan Konsolidasi",
  segmentReporting: "Segment Reporting (PSAK 7)",
  financialPresentation: "Presentasi Laporan Keuangan (PSAK 1)",
  // Laporan Operasional
  reportOperational: "Laporan Operasional",
  arap: "AR/AP",
  reportPurchase: "Laporan Purchase Order",
  reportSales: "Laporan Sales & Marketing",
  reportInventory: "Laporan Inventory & Gudang",
  reportWorkOrder: "Laporan Work Order",
  // Laporan Aset & Investasi
  reportAssets: "Laporan Aset & Investasi",
  assets: "Aset",
  depreciation: "Penyusutan",
  intangibleAssets: "Aset Tak Berwujud",
  investmentReport: "Laporan Investasi",
  // Laporan Pajak
  reportTax: "Laporan Pajak",
  taxes: "Pajak",
  // Laporan Bank
  reportBank: "Laporan Bank",
  bankReport: "Laporan Rekening Bank",
  // Master Data
  accounts: "Daftar Akun",
  subscription: "Berlangganan",
  organizationAdmin: "Admin Organisasi",
  organizationSettings: "Pengaturan Organisasi",
  auditTrail: "Audit Trail",
  workOrder: "Work Order",
  inventory: "Inventory",
  warehouse: "Gudang / Multi Warehouse",
  branch: "Cabang / Branch",
  stockOpname: "Stock Opname",
  inventoryReport: "Laporan Inventory",
  customer: "Customer",
  supplier: "Supplier",
  sales: "Sales / Marketing",
  deliveryOrder: "Delivery Order",
  invoice: "Invoice",
  commission: "Komisi Sales",
  budget: "Budgeting",
  // Platform Admin
  platformAdmin: "Platform Admin",
  backupRestore: "Backup & Restore Database",
} as const

export type ModulePermission = keyof typeof MODULE_PERMISSION_LABELS

export const ALL_MODULE_PERMISSIONS = Object.keys(MODULE_PERMISSION_LABELS) as ModulePermission[]

const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, ModulePermission[]> = {
  ADMIN: ALL_MODULE_PERMISSIONS.filter(p => 
    p !== "balanceSheet" && p !== "incomeStatement" && p !== "cashFlow"
  ),
  MANAGER: [
    "dashboard",
    "transactions",
    "bank",
    "investments",
    "hrga",
    "payroll",
    "reports",
    "balanceSheet",
    "incomeStatement",
    "cashFlow",
    "accounts",
    "assets",
    "depreciation",
    "taxes",
    "auditTrail",
    "subscription",
    "arap",
    "workOrder",
    "inventory",
    "warehouse",
    "branch",
    "stockOpname",
    "inventoryReport",
    "customer",
    "supplier",
    "sales",
    "deliveryOrder",
    "invoice",
    "commission",
    "organizationAdmin",
    "organizationSettings",
  ],
  STAFF: [
    "dashboard",
    "transactions",
    "bank",
    "investments",
    "hrga",
    "payroll",
    "assets",
    "depreciation",
    "subscription",
    "arap",
    "workOrder",
    "inventory",
    "warehouse",
    "branch",
    "stockOpname",
    "customer",
    "supplier",
    "sales",
    "deliveryOrder",
    "invoice",
  ],
  VIEWER: ["dashboard", "reports", "subscription"],
}

export function normalizeModulePermissions(input: string[]) {
  return Array.from(new Set(input.filter((permission): permission is ModulePermission =>
    ALL_MODULE_PERMISSIONS.includes(permission as ModulePermission)
  )))
}

export function getEffectiveModulePermissions(user: Pick<User, "role" | "isPlatformAdmin" | "permissions">) {
  if (user.isPlatformAdmin) {
    return ALL_MODULE_PERMISSIONS
  }

  const stored = normalizeModulePermissions(user.permissions || [])
  // Use default permissions if stored is empty (empty array means use default)
  if (stored.length === 0) {
    return DEFAULT_ROLE_PERMISSIONS[user.role]
  }
  
  return stored
}

export function hasModulePermission(
  user: Pick<User, "role" | "isPlatformAdmin" | "permissions">,
  permission: ModulePermission,
) {
  return getEffectiveModulePermissions(user).includes(permission)
}
