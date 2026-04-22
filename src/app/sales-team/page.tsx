import { getSalesTeam, getOrganizationUsers } from "@/app/actions/sales-team"
import { requireCurrentOrganization } from "@/lib/auth"
import SalesTeamManager from "@/components/sales-team/SalesTeamManager"

export default async function SalesTeamPage() {
  const { organization } = await requireCurrentOrganization()
  const [salesTeam, allUsers] = await Promise.all([
    getSalesTeam(),
    getOrganizationUsers()
  ])

  return (
    <div className="p-6">
      <SalesTeamManager 
        salesTeam={salesTeam} 
        allUsers={allUsers}
        organizationId={organization.id} 
      />
    </div>
  )
}
