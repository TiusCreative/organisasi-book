import { getBranches } from "@/app/actions/branch"
import { requireCurrentOrganization } from "@/lib/auth"
import BranchManager from "@/components/branch/BranchManager"

export default async function BranchPage() {
  const { organization } = await requireCurrentOrganization()
  const branches = await getBranches()

  return (
    <div className="p-6">
      <BranchManager 
        branches={branches} 
        organizationId={organization.id} 
      />
    </div>
  )
}
