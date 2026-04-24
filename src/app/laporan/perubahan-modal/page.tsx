import { requireCurrentOrganization, requireModuleAccess } from "@/lib/auth"
import { DollarSign } from "lucide-react"
import { resolveDateRange, formatInputDate, formatDateRange } from "@/lib/date-range"
import EquityChangesStatement from "@/components/reports/EquityChangesStatement"
import ReportActionButtons from "@/components/reports/ReportActionButtons"

type PageProps = {
  searchParams?: Promise<{
    startDate?: string
    endDate?: string
  }>
}

export default async function PerubahanModalPage({ searchParams }: PageProps) {
  await requireModuleAccess("reports")
  const { organization: activeOrg } = await requireCurrentOrganization()

  const params = searchParams ? await searchParams : {}
  const { startDate, endDate } = resolveDateRange(params)
  const pdfUrl = `/api/${activeOrg.id}/reports/perubahan-modal/pdf?startDate=${formatInputDate(startDate)}&endDate=${formatInputDate(endDate)}`
  const whatsappText = [
    "Laporan Perubahan Modal",
    `Nama Organisasi: ${activeOrg.name}`,
    `Periode: ${formatDateRange(startDate, endDate)}`,
  ].join("\n")

  if (!activeOrg) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-0">
        <h1 className="text-2xl font-bold text-slate-800">Laporan Perubahan Modal</h1>
        <p className="text-slate-500 mt-2">Belum ada organisasi. Silakan buat organisasi terlebih dahulu.</p>
      </div>
    )
  }

  return (
    <div className="max-w-full lg:max-w-7xl mx-auto px-4 sm:px-0 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">Laporan Perubahan Modal</h1>
        <p className="text-slate-500 text-sm mt-1">{activeOrg.name}</p>
      </div>

      <ReportActionButtons pdfUrl={pdfUrl} whatsappText={whatsappText} printTargetId="report-content" />

      <div id="report-content" className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-3 flex-col sm:flex-row">
          <DollarSign size={24} className="text-emerald-600" />
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800">Statement of Changes in Equity</h2>
            <p className="text-xs sm:text-sm text-slate-500">Saldo awal, mutasi, dan saldo akhir per akun ekuitas</p>
          </div>
        </div>
        <EquityChangesStatement initialStartDate={formatInputDate(startDate)} initialEndDate={formatInputDate(endDate)} />
      </div>
    </div>
  )
}
