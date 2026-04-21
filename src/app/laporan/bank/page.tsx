import { generateBankOutstandingReport } from "../../../lib/bank-reports"
import { buildOrganizationAddressLines } from "../../../lib/branding"
import ReportActionButtons from "../../../components/reports/ReportActionButtons"
import { requireModuleAccess } from "../../../lib/auth"

type BankReportPageProps = {
  searchParams?: Promise<{
    startDate?: string
    endDate?: string
  }>
}

function parseDate(value: string | undefined, fallback: Date) {
  if (!value) {
    return fallback
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

function formatInputDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export default async function LaporanBankPage({ searchParams }: BankReportPageProps) {
  const { organization: activeOrg } = await requireModuleAccess("reports")

  if (!activeOrg) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-0">
        <h1 className="text-2xl font-bold text-slate-800">Laporan Bank</h1>
        <p className="text-slate-500 mt-2">Belum ada organisasi. Silakan buat organisasi terlebih dahulu.</p>
      </div>
    )
  }

  const params = searchParams ? await searchParams : {}
  const now = new Date()
  const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1)
  const startDate = parseDate(params.startDate, defaultStartDate)
  const endDate = parseDate(params.endDate, now)
  const report = await generateBankOutstandingReport(activeOrg.id, startDate, endDate)
  const totals = report.banks.reduce(
    (accumulator, bank) => {
      accumulator.openingBalance += bank.openingBalance
      accumulator.totalIn += bank.totalIn
      accumulator.totalOut += bank.totalOut
      accumulator.ledgerEndingBalance += bank.ledgerEndingBalance
      accumulator.statementBalance += bank.statementBalance
      accumulator.outstanding += bank.outstanding
      return accumulator
    },
    {
      openingBalance: 0,
      totalIn: 0,
      totalOut: 0,
      ledgerEndingBalance: 0,
      statementBalance: 0,
      outstanding: 0,
    }
  )
  const addressLines = buildOrganizationAddressLines(activeOrg)
  const pdfUrl = `/api/${activeOrg.id}/reports/bank/pdf?startDate=${formatInputDate(startDate)}&endDate=${formatInputDate(endDate)}`
  const whatsappText = [
    "Laporan Bank & Outstanding",
    `Nama ${activeOrg.type === "YAYASAN" ? "Yayasan" : "Perusahaan"}: ${activeOrg.name}`,
    ...addressLines.map((line) => `Alamat: ${line}`),
    `Periode: ${report.period.startDate.toLocaleDateString("id-ID")} s.d. ${report.period.endDate.toLocaleDateString("id-ID")}`,
    `Jumlah Rekening: ${report.banks.length}`,
    `Outstanding: Rp ${totals.outstanding.toLocaleString("id-ID")}`,
  ].join("\n")

  return (
    <div className="max-w-full lg:max-w-6xl mx-auto px-4 sm:px-0 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Laporan Bank & Outstanding</h1>
        <p className="text-slate-500 text-sm mt-1">
          {activeOrg.name} - Periode {report.period.startDate.toLocaleDateString("id-ID")} s.d. {report.period.endDate.toLocaleDateString("id-ID")}
        </p>
      </div>

      <form className="flex flex-col sm:flex-row gap-3">
        <input
          type="date"
          name="startDate"
          defaultValue={formatInputDate(startDate)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <input
          type="date"
          name="endDate"
          defaultValue={formatInputDate(endDate)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
          Tampilkan Laporan
        </button>
      </form>

      <ReportActionButtons pdfUrl={pdfUrl} whatsappText={whatsappText} printTargetId="report-content" />

      <div id="report-content" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Saldo Awal</p>
            <p className="mt-2 text-2xl font-bold text-slate-800">Rp {totals.openingBalance.toLocaleString("id-ID")}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Mutasi Masuk</p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">Rp {totals.totalIn.toLocaleString("id-ID")}</p>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-rose-700">Mutasi Keluar</p>
            <p className="mt-2 text-2xl font-bold text-rose-700">Rp {totals.totalOut.toLocaleString("id-ID")}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Outstanding</p>
            <p className="mt-2 text-2xl font-bold text-amber-700">Rp {totals.outstanding.toLocaleString("id-ID")}</p>
          </div>
        </div>

        <div className="space-y-4">
          {report.banks.map((bank) => (
            <div key={bank.bankId} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
                <h2 className="text-lg font-bold text-slate-800">{bank.bankName}</h2>
                <p className="text-sm text-slate-500">
                  {bank.accountNumber} a.n. {bank.accountName}
                </p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 px-6 py-5 border-b border-slate-100">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Saldo Awal</p>
                  <p className="mt-2 font-bold text-slate-800">Rp {bank.openingBalance.toLocaleString("id-ID")}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">Masuk</p>
                  <p className="mt-2 font-bold text-emerald-600">Rp {bank.totalIn.toLocaleString("id-ID")}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-rose-600">Keluar</p>
                  <p className="mt-2 font-bold text-rose-600">Rp {bank.totalOut.toLocaleString("id-ID")}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Saldo Buku</p>
                  <p className="mt-2 font-bold text-blue-700">Rp {bank.ledgerEndingBalance.toLocaleString("id-ID")}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-600">Saldo Statement / Outstanding</p>
                  <p className="mt-2 font-bold text-amber-700">
                    Rp {bank.statementBalance.toLocaleString("id-ID")} / {bank.outstanding.toLocaleString("id-ID")}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-6 py-3 font-bold">Tanggal</th>
                      <th className="px-6 py-3 font-bold">No. Nota</th>
                      <th className="px-6 py-3 font-bold">Keterangan</th>
                      <th className="px-6 py-3 font-bold">Arah</th>
                      <th className="px-6 py-3 font-bold text-right">Nominal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bank.transactions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-6 text-center text-slate-500">
                          Tidak ada transaksi bank pada periode ini.
                        </td>
                      </tr>
                    ) : (
                      bank.transactions.map((transaction) => (
                        <tr key={`${bank.bankId}-${transaction.transactionId}`}>
                          <td className="px-6 py-3">{transaction.date.toLocaleDateString("id-ID")}</td>
                          <td className="px-6 py-3 font-mono text-xs text-blue-600">{transaction.reference || "-"}</td>
                          <td className="px-6 py-3">{transaction.description}</td>
                          <td className="px-6 py-3">
                            <span className={`rounded-full px-2 py-1 text-xs font-bold ${transaction.direction === "IN" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                              {transaction.direction === "IN" ? "Masuk" : "Keluar"}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-right font-bold">Rp {transaction.amount.toLocaleString("id-ID")}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
