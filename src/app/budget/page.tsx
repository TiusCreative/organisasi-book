import { getBudgets } from "@/app/actions/budget"
import { requireCurrentOrganization } from "@/lib/auth"
import BudgetManager from "@/components/budget/BudgetManager"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default async function BudgetPage() {
  const { organization } = await requireCurrentOrganization()
  const budgets = await getBudgets()

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors">
          <ArrowLeft size={20} />
          <span>Kembali ke Dashboard</span>
        </Link>
      </div>
      <BudgetManager 
        budgets={budgets} 
        organizationId={organization.id} 
      />
    </div>
  )
}
