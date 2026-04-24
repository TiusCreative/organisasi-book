import { requireCurrentOrganization, requireModuleAccess } from "@/lib/auth"
import { Layers } from "lucide-react"
import { resolveDateRange, formatInputDate, formatDateRange } from "@/lib/date-range"
import ReservesAndDistributionsReport from "@/components/reports/ReservesAndDistributionsReport"
import ReportActionButtons from "@/components/reports/ReportActionButtons"

type PageProps = {
  searchParams?: Promise<{
    startDate?: string
    endDate?: string
  }>
}

export default async function CadanganDistribusiPage({ searchParams }: PageProps) {
  await requireModuleAccess("reports")
  const { organization: activeOrg } = await requireCurrentOrganization()

  const params = searchParams ? await searchParams : {}
  const { startDate, endDate } = resolveDateRange(params)
  const pdfUrl = `/api/${activeOrg.id}/reports/cadangan-distribusi/pdf?startDate=${formatInputDate(startDate)}&endDate=${formatInputDate(endDate)}`
  const whatsappText = [
    "Cadangan & Distribusi Laba",
    `Nama Organisasi: ${activeOrg.name}`,
    `Periode: ${formatDateRange(startDate, endDate)}`,
  ].join("\n")

  if (!activeOrg) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-0">
        <h1 className="text-2xl font-bold text-slate-800">Cadangan & Distribusi Laba</h1>
        <p className="text-slate-500 mt-2">Belum ada organisasi. Silakan buat organisasi terlebih dahulu.</p>
      </div>
    )
  }

  return (
    <div className="max-w-full lg:max-w-7xl mx-auto px-4 sm:px-0 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">Cadangan & Distribusi Laba</h1>
        <p className="text-slate-500 text-sm mt-1">{activeOrg.name}</p>
      </div>

      <ReportActionButtons pdfUrl={pdfUrl} whatsappText={whatsappText} printTargetId="report-content" />

      <div id="report-content" className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-3 flex-col sm:flex-row">
          <Layers size={24} className="text-slate-700" />
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800">Ringkasan Cadangan/Distribusi</h2>
            <p className="text-xs sm:text-sm text-slate-500">Ekuitas selain Modal dan Laba Ditahan (termasuk Dividen bila ada)</p>
          </div>
        </div>
        <ReservesAndDistributionsReport initialStartDate={formatInputDate(startDate)} initialEndDate={formatInputDate(endDate)} />
      </div>
    </div>
  )
}
