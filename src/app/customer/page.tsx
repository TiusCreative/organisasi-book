import { getCustomers } from "@/app/actions/customer"
import { requireCurrentOrganization } from "@/lib/auth"
import CustomerManager from "@/components/customer/CustomerManager"

export default async function CustomerPage() {
  const { organization } = await requireCurrentOrganization()
  const customers = await getCustomers()

  return (
    <div className="p-6">
      <CustomerManager 
        customers={customers} 
        organizationId={organization.id} 
      />
    </div>
  )
}
