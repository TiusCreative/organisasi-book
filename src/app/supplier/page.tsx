import { getSuppliers } from "@/app/actions/supplier"
import { requireCurrentOrganization } from "@/lib/auth"
import SupplierManager from "@/components/supplier/SupplierManager"

export default async function SupplierPage() {
  const { organization } = await requireCurrentOrganization()
  const suppliers = await getSuppliers()

  return (
    <div className="p-6">
      <SupplierManager 
        suppliers={suppliers} 
        organizationId={organization.id} 
      />
    </div>
  )
}
