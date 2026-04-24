import { requireCurrentOrganization, requireModuleAccess } from "@/lib/auth"
import { Briefcase } from "lucide-react"
import { resolveDateRange, formatInputDate, formatDateRange } from "@/lib/date-range"
import BusinessCombinationReport from "@/components/reports/BusinessCombinationReport"
import ReportActionButtons from "@/components/reports/ReportActionButtons"

type PageProps = {
  searchParams?: Promise<{
    startDate?: string
    endDate?: string
  }>
}

export default async function KombinasiBisnisPage({ searchParams }: PageProps) {
  await requireModuleAccess("reports")
  const { organization: activeOrg } = await requireCurrentOrganization()

  const params = searchParams ? await searchParams : {}
  const { startDate, endDate } = resolveDateRange(params)
  const pdfUrl = `/api/${activeOrg.id}/reports/kombinasi-bisnis/pdf?startDate=${formatInputDate(startDate)}&endDate=${formatInputDate(endDate)}`
  const whatsappText = [
    "Kombinasi Bisnis (Business Combination)",
    `Nama Organisasi: ${activeOrg.name}`,
    `Periode: ${formatDateRange(startDate, endDate)}`,
  ].join("\n")

  if (!activeOrg) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-0">
        <h1 className="text-2xl font-bold text-slate-800">Kombinasi Bisnis</h1>
        <p className="text-slate-500 mt-2">Belum ada organisasi. Silakan buat organisasi terlebih dahulu.</p>
      </div>
    )
  }

  return (
    <div className="max-w-full lg:max-w-7xl mx-auto px-4 sm:px-0 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">Kombinasi Bisnis (Business Combination)</h1>
        <p className="text-slate-500 text-sm mt-1">{activeOrg.name}</p>
      </div>

      <ReportActionButtons pdfUrl={pdfUrl} whatsappText={whatsappText} printTargetId="report-content" />

      <div id="report-content" className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-3 flex-col sm:flex-row">
          <Briefcase size={24} className="text-indigo-600" />
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800">Laporan Kombinasi Bisnis</h2>
            <p className="text-xs sm:text-sm text-slate-500">Akuisisi, merger, dan konsolidasi entitas bisnis sesuai IFRS 3</p>
          </div>
        </div>
        <BusinessCombinationReport initialStartDate={formatInputDate(startDate)} initialEndDate={formatInputDate(endDate)} />
      </div>
    </div>
  )
}
