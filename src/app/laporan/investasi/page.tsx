import { generateInvestmentReport } from "../../../lib/investment-reports"
import { buildOrganizationAddressLines } from "../../../lib/branding"
import ReportActionButtons from "../../../components/reports/ReportActionButtons"
import { requireModuleAccess } from "../../../lib/auth"

type InvestmentReportPageProps = {
  searchParams?: Promise<{
    type?: string
    status?: string
    startDate?: string
    endDate?: string
  }>
}

function parseDate(value?: string) {
  if (!value) return undefined
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function formatInputDate(date?: Date) {
  return date ? date.toISOString().slice(0, 10) : ""
}

export default async function LaporanInvestasiPage({ searchParams }: InvestmentReportPageProps) {
  const { organization: activeOrg } = await requireModuleAccess("reports")

  if (!activeOrg) {
    return (
      <div className="max-w-full lg:max-w-6xl mx-auto px-4 sm:px-0">
        <h1 className="text-2xl font-bold text-slate-800">Laporan Investasi</h1>
        <p className="text-slate-500 mt-2">Belum ada organisasi. Silakan buat organisasi terlebih dahulu.</p>
      </div>
    )
  }

  const params = searchParams ? await searchParams : {}
  const startDate = parseDate(params.startDate)
  const endDate = parseDate(params.endDate)

  const report = await generateInvestmentReport({
    organizationId: activeOrg.id,
    type: params.type || undefined,
    status: params.status || undefined,
    startDate,
    endDate,
  })
  const addressLines = buildOrganizationAddressLines(activeOrg)
  const searchQuery = new URLSearchParams()
  if (params.type) searchQuery.set("type", params.type)
  if (params.status) searchQuery.set("status", params.status)
  if (startDate) searchQuery.set("startDate", formatInputDate(startDate))
  if (endDate) searchQuery.set("endDate", formatInputDate(endDate))
  const pdfUrl = `/api/${activeOrg.id}/reports/investasi/pdf?${searchQuery.toString()}`
  const whatsappText = [
    "Laporan Investasi",
    `Nama ${activeOrg.type === "YAYASAN" ? "Yayasan" : "Perusahaan"}: ${activeOrg.name}`,
    ...addressLines.map((line) => `Alamat: ${line}`),
    `Jumlah Investasi: ${report.summary.totalInvestments}`,
    `Total Perolehan: Rp ${report.summary.totalPurchaseAmount.toLocaleString("id-ID")}`,
    `Nilai Buku: Rp ${report.summary.totalCurrentValue.toLocaleString("id-ID")}`,
    `Untung/Rugi Belum Realisasi: Rp ${report.summary.totalUnrealizedGainLoss.toLocaleString("id-ID")}`,
  ].join("\n")

  return (
    <div className="max-w-full lg:max-w-6xl mx-auto px-4 sm:px-0 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Laporan Investasi</h1>
        <p className="text-slate-500 text-sm mt-1">{activeOrg.name}</p>
      </div>

      <form className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <select name="type" defaultValue={params.type || ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">Semua Jenis</option>
          <option value="DEPOSITO">Deposito</option>
          <option value="SAHAM">Saham</option>
          <option value="INVESTASI_LAINNYA">Investasi Lainnya</option>
        </select>
        <select name="status" defaultValue={params.status || ""} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">Semua Status</option>
          <option value="ACTIVE">Aktif</option>
          <option value="MATURED">Jatuh Tempo</option>
          <option value="LIQUIDATED">Sudah Diinkaso</option>
        </select>
        <input type="date" name="startDate" defaultValue={formatInputDate(startDate)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <input type="date" name="endDate" defaultValue={formatInputDate(endDate)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">Tampilkan</button>
      </form>

      <ReportActionButtons pdfUrl={pdfUrl} whatsappText={whatsappText} printTargetId="report-content" />

      <div id="report-content" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Jumlah</p>
            <p className="mt-2 text-2xl font-bold text-slate-800">{report.summary.totalInvestments}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Perolehan</p>
            <p className="mt-2 text-xl font-bold text-slate-800">Rp {report.summary.totalPurchaseAmount.toLocaleString("id-ID")}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Nilai Buku</p>
            <p className="mt-2 text-xl font-bold text-slate-800">Rp {report.summary.totalCurrentValue.toLocaleString("id-ID")}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Estimasi Hasil</p>
            <p className="mt-2 text-xl font-bold text-emerald-700">Rp {report.summary.totalExpectedReturn.toLocaleString("id-ID")}</p>
          </div>
          <div className={`rounded-xl border p-4 ${report.summary.totalUnrealizedGainLoss >= 0 ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
            <p className="text-xs font-bold uppercase tracking-wide">Untung/Rugi Belum Realisasi</p>
            <p className="mt-2 text-xl font-bold">Rp {report.summary.totalUnrealizedGainLoss.toLocaleString("id-ID")}</p>
          </div>
          <div className={`rounded-xl border p-4 ${report.summary.totalRealizedGainLoss >= 0 ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
            <p className="text-xs font-bold uppercase tracking-wide">Untung/Rugi Realisasi</p>
            <p className="mt-2 text-xl font-bold">Rp {report.summary.totalRealizedGainLoss.toLocaleString("id-ID")}</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-600">
                  <th className="px-4 py-3 font-bold">Jenis</th>
                  <th className="px-4 py-3 font-bold">Nama</th>
                  <th className="px-4 py-3 font-bold">Institusi</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold text-right">Perolehan</th>
                  <th className="px-4 py-3 font-bold text-right">Nilai Buku</th>
                  <th className="px-4 py-3 font-bold text-right">Untung/Rugi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">Tidak ada data investasi untuk filter ini.</td>
                  </tr>
                ) : (
                  report.rows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3">{row.type.replaceAll("_", " ")}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-800">{row.name}</div>
                        <div className="text-xs text-slate-500">{new Date(row.startDate).toLocaleDateString("id-ID")}</div>
                      </td>
                      <td className="px-4 py-3">{row.institution}</td>
                      <td className="px-4 py-3">{row.status}</td>
                      <td className="px-4 py-3 text-right font-mono">Rp {Number(row.purchaseAmount).toLocaleString("id-ID")}</td>
                      <td className="px-4 py-3 text-right font-mono">Rp {Number(row.currentValue).toLocaleString("id-ID")}</td>
                      <td className={`px-4 py-3 text-right font-mono font-bold ${row.unrealizedGainLoss >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                        Rp {row.unrealizedGainLoss.toLocaleString("id-ID")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
