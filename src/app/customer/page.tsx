import { getCustomers } from "@/app/actions/customer"
import { requireCurrentOrganization } from "@/lib/auth"
import CustomerManager from "@/components/customer/CustomerManager"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default async function CustomerPage() {
  const { organization } = await requireCurrentOrganization()
  const customers = await getCustomers()

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors">
          <ArrowLeft size={20} />
          <span>Kembali ke Dashboard</span>
        </Link>
      </div>
      <CustomerManager 
        customers={customers} 
        organizationId={organization.id} 
      />
    </div>
  )
}
