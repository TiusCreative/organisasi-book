import { requireCurrentOrganization, requireModuleAccess } from "@/lib/auth"
import { getInventoryItems, getInventoryMovements, getStockOpnames } from "@/app/actions/inventory"
import { getWarehouses } from "@/app/actions/work-order"
import InventoryManager from "@/components/inventory/InventoryManager"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default async function InventoryPage() {
  await requireModuleAccess("inventory")
  const { organization } = await requireCurrentOrganization()

  const [inventoryItems, warehouses, stockOpnames, movements] = await Promise.all([
    getInventoryItems(organization.id),
    getWarehouses(organization.id),
    getStockOpnames(organization.id),
    getInventoryMovements(organization.id),
  ])

  return (
    <div className="max-w-6xl mx-auto py-10">
      <div className="mb-6">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors">
          <ArrowLeft size={20} />
          <span>Kembali ke Dashboard</span>
        </Link>
      </div>
      <h1 className="text-2xl font-bold mb-2 text-blue-700">Inventory</h1>
      <p className="mb-6 text-sm text-slate-500">Organisasi aktif: {organization.name}</p>
      <InventoryManager 
        initialItems={inventoryItems}
        warehouses={warehouses}
        stockOpnames={stockOpnames}
        movements={movements}
        organizationId={organization.id}
      />
    </div>
  )
}
