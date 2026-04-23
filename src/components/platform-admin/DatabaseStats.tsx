"use client"

import { Users, Building2, Receipt, Wallet, UserCircle, FileText, ShoppingCart, Package } from "lucide-react"

interface DatabaseStatsProps {
  stats: {
    users: number
    organizations: number
    transactions: number
    accounts: number
    employees: number
    invoices: number
    vendorBills: number
    inventoryItems: number
    salesOrders: number
  }
}

export default function DatabaseStats({ stats }: DatabaseStatsProps) {
  const statItems = [
    {
      label: "Users",
      value: stats.users,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      label: "Organisasi",
      value: stats.organizations,
      icon: Building2,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      label: "Transaksi",
      value: stats.transactions,
      icon: Receipt,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      label: "Akun COA",
      value: stats.accounts,
      icon: Wallet,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
    {
      label: "Karyawan",
      value: stats.employees,
      icon: UserCircle,
      color: "text-rose-600",
      bgColor: "bg-rose-50",
    },
    {
      label: "Invoices",
      value: stats.invoices,
      icon: FileText,
      color: "text-cyan-600",
      bgColor: "bg-cyan-50",
    },
    {
      label: "Vendor Bills",
      value: stats.vendorBills,
      icon: ShoppingCart,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      label: "Inventory Items",
      value: stats.inventoryItems,
      icon: Package,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {statItems.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4"
        >
          <div className={`rounded-lg ${item.bgColor} p-2`}>
            <item.icon className={item.color} size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500">{item.label}</p>
            <p className="text-xl font-bold text-slate-800">
              {item.value.toLocaleString("id-ID")}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
