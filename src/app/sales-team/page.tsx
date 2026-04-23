import { getSalesTeam, getOrganizationUsers } from "@/app/actions/sales-team"
import { requireCurrentOrganization } from "@/lib/auth"
import SalesTeamManager from "@/components/sales-team/SalesTeamManager"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default async function SalesTeamPage() {
  const { organization } = await requireCurrentOrganization()
  const [salesTeam, allUsers] = await Promise.all([
    getSalesTeam(),
    getOrganizationUsers()
  ])

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors">
          <ArrowLeft size={20} />
          <span>Kembali ke Dashboard</span>
        </Link>
      </div>
      <SalesTeamManager 
        salesTeam={salesTeam} 
        allUsers={allUsers}
        organizationId={organization.id} 
      />
    </div>
  )
}
