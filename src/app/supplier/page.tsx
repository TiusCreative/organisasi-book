import { getSuppliers } from "@/app/actions/supplier"
import { requireCurrentOrganization } from "@/lib/auth"
import SupplierManager from "@/components/supplier/SupplierManager"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default async function SupplierPage() {
  const { organization } = await requireCurrentOrganization()
  const suppliers = await getSuppliers()

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors">
          <ArrowLeft size={20} />
          <span>Kembali ke Dashboard</span>
        </Link>
      </div>
      <SupplierManager 
        suppliers={suppliers} 
        organizationId={organization.id} 
      />
    </div>
  )
}
