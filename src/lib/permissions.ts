import type { User, UserRole } from "@prisma/client"

export const MODULE_PERMISSION_LABELS = {
  dashboard: "Dashboard",
  transactions: "Transaksi",
  bank: "Rekening Bank",
  investments: "Investasi",
  reports: "Laporan",
  accounts: "Daftar Akun",
  assets: "Aset",
  depreciation: "Penyusutan",
  payroll: "Gaji",
  taxes: "Pajak",
  subscription: "Berlangganan",
  organizationAdmin: "Admin Organisasi",
  organizationSettings: "Pengaturan Organisasi",
  auditTrail: "Audit Trail",
  arap: "AR/AP",
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
} as const

export type ModulePermission = keyof typeof MODULE_PERMISSION_LABELS

export const ALL_MODULE_PERMISSIONS = Object.keys(MODULE_PERMISSION_LABELS) as ModulePermission[]

const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, ModulePermission[]> = {
  ADMIN: ALL_MODULE_PERMISSIONS,
  MANAGER: [
    "dashboard",
    "transactions",
    "bank",
    "investments",
    "reports",
    "accounts",
    "assets",
    "depreciation",
    "payroll",
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
  return stored.length > 0 ? stored : DEFAULT_ROLE_PERMISSIONS[user.role]
}

export function hasModulePermission(
  user: Pick<User, "role" | "isPlatformAdmin" | "permissions">,
  permission: ModulePermission,
) {
  return getEffectiveModulePermissions(user).includes(permission)
}
