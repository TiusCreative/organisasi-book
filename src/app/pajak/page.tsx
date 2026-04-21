import Link from "next/link"
import { prisma } from "../../lib/prisma"
import { formatRupiah } from "../../lib/tax-utils"
import { formatDateRange, formatInputDate, resolveDateRange } from "../../lib/date-range"
import { buildOrganizationAddressLines } from "../../lib/branding"
import ReportActionButtons from "../../components/reports/ReportActionButtons"
import { requireModuleAccess } from "../../lib/auth"

function formatPeriod(month: number, year: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  })
}

type PajakPageProps = {
  searchParams?: Promise<{
    startDate?: string
    endDate?: string
  }>
}

function isSalarySlipInRange(month: number, year: number, startDate: Date, endDate: Date) {
  const slipStartDate = new Date(year, month - 1, 1)
  const slipEndDate = new Date(year, month, 0, 23, 59, 59, 999)
  return slipEndDate >= startDate && slipStartDate <= endDate
}

export default async function PajakPage({ searchParams }: PajakPageProps) {
  const { organization } = await requireModuleAccess("taxes")
  const params = searchParams ? await searchParams : {}
  const { startDate, endDate } = resolveDateRange(params)
  const activeOrg = await prisma.organization.findUnique({
    where: { id: organization.id },
    include: {
      taxEntries: {
        where: {
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }, { date: "desc" }],
      },
      salarySlips: {
        orderBy: [{ year: "desc" }, { month: "desc" }],
        include: { employee: true },
      },
    },
  })

  if (!activeOrg) {
    return (
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-800">Pajak</h1>
        <p className="text-slate-500 mt-2">Belum ada organisasi. Silakan buat organisasi terlebih dahulu.</p>
      </div>
    )
  }

  const taxEntries = activeOrg.taxEntries
  const filteredSalarySlips = activeOrg.salarySlips.filter((slip) =>
    isSalarySlipInRange(slip.month, slip.year, startDate, endDate)
  )

  const totals = {
    pph21: taxEntries
      .filter((entry) => entry.taxType === "PPH21")
      .reduce((sum, entry) => sum + entry.taxAmount, 0),
    pph23: taxEntries
      .filter((entry) => entry.taxType === "PPH23")
      .reduce((sum, entry) => sum + entry.taxAmount, 0),
    ppn: taxEntries
      .filter((entry) => entry.taxType === "PPN")
      .reduce((sum, entry) => sum + entry.taxAmount, 0),
  }
  const addressLines = buildOrganizationAddressLines(activeOrg)
  const pdfUrl = `/api/${activeOrg.id}/reports/pajak/pdf?startDate=${formatInputDate(startDate)}&endDate=${formatInputDate(endDate)}`
  const whatsappText = [
    "Laporan Pajak",
    `Nama ${activeOrg.type === "YAYASAN" ? "Yayasan" : "Perusahaan"}: ${activeOrg.name}`,
    ...addressLines.map((line) => `Alamat: ${line}`),
    `Periode: ${formatDateRange(startDate, endDate)}`,
    `PPh 21: ${formatRupiah(totals.pph21)}`,
    `PPh 23: ${formatRupiah(totals.pph23)}`,
    `PPN: ${formatRupiah(totals.ppn)}`,
  ].join("\n")

  const periodSummaries = Array.from(
    taxEntries.reduce((map, entry) => {
      const key = `${entry.periodYear}-${String(entry.periodMonth).padStart(2, "0")}`
      const current = map.get(key) || {
        periodMonth: entry.periodMonth,
        periodYear: entry.periodYear,
        pph21: 0,
        pph23: 0,
        ppn: 0,
      }

      if (entry.taxType === "PPH21") current.pph21 += entry.taxAmount
      if (entry.taxType === "PPH23") current.pph23 += entry.taxAmount
      if (entry.taxType === "PPN") current.ppn += entry.taxAmount

      map.set(key, current)
      return map
    }, new Map<string, { periodMonth: number; periodYear: number; pph21: number; pph23: number; ppn: number }>())
  )
    .map(([, value]) => value)
    .sort((a, b) => {
      if (a.periodYear !== b.periodYear) return b.periodYear - a.periodYear
      return b.periodMonth - a.periodMonth
    })

  return (
    <div className="max-w-full lg:max-w-6xl mx-auto px-4 sm:px-0 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Pajak</h1>
          <p className="text-slate-500 text-sm mt-1">
            Lihat, hitung, dan pantau PPh 21, PPh 23, serta PPN untuk periode {formatDateRange(startDate, endDate)}.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/transaksi"
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-colors"
          >
            Catat Pajak dari Transaksi
          </Link>
          <Link
            href="/gaji"
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors"
          >
            Hitung PPh 21 dari Payroll
          </Link>
        </div>
      </div>

      <form className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          type="date"
          name="startDate"
          defaultValue={formatInputDate(startDate)}
          className="form-field rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <input
          type="date"
          name="endDate"
          defaultValue={formatInputDate(endDate)}
          className="form-field rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
          Tampilkan Periode
        </button>
      </form>

      <ReportActionButtons pdfUrl={pdfUrl} whatsappText={whatsappText} printTargetId="report-content" />

      <div id="report-content" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <p className="text-sm font-bold text-slate-500">PPh 21</p>
            <p className="text-3xl font-bold text-slate-800 mt-2">{formatRupiah(totals.pph21)}</p>
            <p className="text-xs text-slate-400 mt-2">{formatDateRange(startDate, endDate)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <p className="text-sm font-bold text-slate-500">PPh 23</p>
            <p className="text-3xl font-bold text-slate-800 mt-2">{formatRupiah(totals.pph23)}</p>
            <p className="text-xs text-slate-400 mt-2">Dari transaksi keluar yang dipotong pajak pada periode terpilih</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <p className="text-sm font-bold text-slate-500">PPN</p>
            <p className="text-3xl font-bold text-slate-800 mt-2">{formatRupiah(totals.ppn)}</p>
            <p className="text-xs text-slate-400 mt-2">Akumulasi PPN dari transaksi dengan pajak pada periode terpilih</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-6">
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-800">Laporan Pajak per Periode</h2>
              <p className="text-sm text-slate-500 mt-1">Ringkasan PPh 21, PPh 23, dan PPN.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 text-left text-sm text-slate-600">
                  <tr>
                    <th className="px-6 py-3 font-bold">Periode</th>
                    <th className="px-6 py-3 font-bold">PPh 21</th>
                    <th className="px-6 py-3 font-bold">PPh 23</th>
                    <th className="px-6 py-3 font-bold">PPN</th>
                    <th className="px-6 py-3 font-bold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {periodSummaries.map((summary) => {
                    const total = summary.pph21 + summary.pph23 + summary.ppn
                    return (
                      <tr key={`${summary.periodYear}-${summary.periodMonth}`}>
                        <td className="px-6 py-4 font-medium text-slate-800">
                          {formatPeriod(summary.periodMonth, summary.periodYear)}
                        </td>
                        <td className="px-6 py-4 text-slate-700">{formatRupiah(summary.pph21)}</td>
                        <td className="px-6 py-4 text-slate-700">{formatRupiah(summary.pph23)}</td>
                        <td className="px-6 py-4 text-slate-700">{formatRupiah(summary.ppn)}</td>
                        <td className="px-6 py-4 font-bold text-slate-800">{formatRupiah(total)}</td>
                      </tr>
                    )
                  })}
                  {periodSummaries.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                        Belum ada catatan pajak. Coba buat transaksi dengan PPN/PPh 23 atau generate slip gaji.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="font-bold text-slate-800">Catatan Pajak Terbaru</h2>
                <p className="text-sm text-slate-500 mt-1">Hasil auto-calculation dari transaksi dan gaji pada periode terpilih.</p>
              </div>
              <div className="divide-y divide-slate-100">
                {taxEntries.slice(0, 8).map((entry) => (
                  <div key={entry.id} className="px-6 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-bold text-slate-800">{entry.taxType}</p>
                        <p className="text-sm text-slate-500 mt-1">{entry.description}</p>
                        <p className="text-xs text-slate-400 mt-2">
                          {new Date(entry.date).toLocaleDateString("id-ID")} • Dasar {formatRupiah(entry.taxBase)}
                        </p>
                      </div>
                      <p className="font-bold text-slate-800">{formatRupiah(entry.taxAmount)}</p>
                    </div>
                  </div>
                ))}
                {taxEntries.length === 0 && (
                  <div className="px-6 py-8 text-sm text-slate-500">
                    Belum ada entri pajak otomatis.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="font-bold text-slate-800">Payroll Terakhir</h2>
                <p className="text-sm text-slate-500 mt-1">PPh 21 dari slip gaji yang berada dalam periode terpilih.</p>
              </div>
              <div className="divide-y divide-slate-100">
                {filteredSalarySlips.slice(0, 6).map((slip) => (
                  <div key={slip.id} className="px-6 py-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold text-slate-800">{slip.employee.name}</p>
                      <p className="text-sm text-slate-500 mt-1">{formatPeriod(slip.month, slip.year)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-800">{formatRupiah(slip.pph21)}</p>
                      <p className="text-xs text-slate-400 mt-1">Bruto {formatRupiah(slip.grossIncome)}</p>
                    </div>
                  </div>
                ))}
                {filteredSalarySlips.length === 0 && (
                  <div className="px-6 py-8 text-sm text-slate-500">
                    Belum ada slip gaji pada periode ini.
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
