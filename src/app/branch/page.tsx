import { getBranches } from "@/app/actions/branch"
import { requireCurrentOrganization } from "@/lib/auth"
import BranchManager from "@/components/branch/BranchManager"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default async function BranchPage() {
  const { organization } = await requireCurrentOrganization()
  const branches = await getBranches()

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors">
          <ArrowLeft size={20} />
          <span>Kembali ke Dashboard</span>
        </Link>
      </div>
      <BranchManager 
        branches={branches} 
        organizationId={organization.id} 
      />
    </div>
  )
}
