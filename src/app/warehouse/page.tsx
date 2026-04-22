import { getWarehouses } from "@/app/actions/warehouse"
import { requireCurrentOrganization } from "@/lib/auth"
import WarehouseManager from "@/components/warehouse/WarehouseManager"

export default async function WarehousePage() {
  const { organization } = await requireCurrentOrganization()
  const warehouses = await getWarehouses()

  return (
    <div className="p-6">
      <WarehouseManager 
        warehouses={warehouses} 
        organizationId={organization.id} 
      />
    </div>
  )
}
