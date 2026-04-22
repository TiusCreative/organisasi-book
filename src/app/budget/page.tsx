import { getBudgets } from "@/app/actions/budget"
import { requireCurrentOrganization } from "@/lib/auth"
import BudgetManager from "@/components/budget/BudgetManager"

export default async function BudgetPage() {
  const { organization } = await requireCurrentOrganization()
  const budgets = await getBudgets()

  return (
    <div className="p-6">
      <BudgetManager 
        budgets={budgets} 
        organizationId={organization.id} 
      />
    </div>
  )
}
