import FinancialDashboard from "./FinancialDashboard"

export default function AccountingDashboardPage() {
  return (
    <div className="container mx-auto py-4">
      <div className="mb-4 text-sm text-slate-500 px-4">
        Dashboard / Akuntansi / <span className="font-semibold text-slate-700">Ringkasan</span>
      </div>
      <FinancialDashboard />
    </div>
  )
}