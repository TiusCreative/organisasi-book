import { requireCurrentOrganization, requireModuleAccess } from "@/lib/auth"
import { getInventoryItems, getInventoryMovements, getStockOpnames } from "@/app/actions/inventory"
import { getWarehouses } from "@/app/actions/work-order"
import InventoryManager from "@/components/inventory/InventoryManager"

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
