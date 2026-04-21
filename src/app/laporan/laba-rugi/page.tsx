import { prisma } from "../../../lib/prisma"
import { generateIncomeStatementByDateRange } from "../../../lib/periodic-financial-reports"
import { formatDateRange, formatInputDate, resolveDateRange } from "../../../lib/date-range"
import { buildOrganizationAddressLines } from "../../../lib/branding"
import { buildIncomeStatementWhatsappText } from "../../../lib/report-whatsapp"
import ReportActionButtons from "../../../components/reports/ReportActionButtons"
import { requireModuleAccess } from "../../../lib/auth"

type IncomeStatementPageProps = {
  searchParams?: Promise<{
    startDate?: string
    endDate?: string
  }>
}

export default async function IncomeStatementPage({ searchParams }: IncomeStatementPageProps) {
  const { organization } = await requireModuleAccess("reports")
  const activeOrg = await prisma.organization.findUnique({
    where: { id: organization.id },
    include: {
      accounts: true,
    }
  })

  if (!activeOrg) {
    return (
      <div className="max-w-full lg:max-w-6xl mx-auto px-4 sm:px-0">
        <h1 className="text-2xl font-bold text-slate-800">Laporan Laba Rugi</h1>
        <p className="text-slate-500 mt-2">Belum ada organisasi. Silakan buat organisasi terlebih dahulu.</p>
      </div>
    )
  }

  const params = searchParams ? await searchParams : {}
  const { startDate, endDate } = resolveDateRange(params)

  const isYayasan = activeOrg.type === 'YAYASAN'

  const reportData = await generateIncomeStatementByDateRange(activeOrg.id, startDate, endDate)

  const totalRevenues = reportData.totalRevenue
  const totalOperatingExpenses = reportData.operatingExpenses.reduce((sum, e) => sum + e.balance, 0)
  const totalAdminExpenses = reportData.administrativeExpenses.reduce((sum, e) => sum + e.balance, 0)
  const totalOtherExpenses = reportData.otherExpenses.reduce((sum, e) => sum + e.balance, 0)
  const totalExpenses = totalOperatingExpenses + totalAdminExpenses + totalOtherExpenses
  const netResult = reportData.netIncome

  const reportTitle = isYayasan 
    ? 'LAPORAN AKTIVITAS (SAK Indonesia - Yayasan)' 
    : 'LAPORAN LABA RUGI (SAK Indonesia - Perusahaan)'

  const resultLabel = isYayasan ? 'SURPLUS / (DEFISIT)' : 'LABA / (RUGI) BERSIH'
  const addressLines = buildOrganizationAddressLines(activeOrg)
  const pdfUrl = `/api/${activeOrg.id}/reports/laba-rugi/pdf?startDate=${formatInputDate(startDate)}&endDate=${formatInputDate(endDate)}`
  const whatsappText = buildIncomeStatementWhatsappText(reportData, {
    name: activeOrg.name,
    addressLines,
    label: `Nama ${isYayasan ? "Yayasan" : "Perusahaan"}`,
    type: activeOrg.type,
  })

  return (
    <div className="max-w-full lg:max-w-4xl mx-auto px-4 sm:px-0 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">{isYayasan ? 'Laporan Aktivitas' : 'Laporan Laba Rugi'}</h1>
          <p className="text-slate-500 text-sm mt-1">{activeOrg.name} - {formatDateRange(reportData.period.startDate, reportData.period.endDate)}</p>
        </div>
      </div>

      <form className="flex flex-col sm:flex-row gap-3">
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

      {/* Action Buttons */}
      <ReportActionButtons pdfUrl={pdfUrl} whatsappText={whatsappText} printTargetId="report-content" />

      {/* Income Statement Report */}
      <div id="report-content" className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 overflow-x-auto">
        <div className="mb-8 text-center">
          <h2 className="text-lg sm:text-xl font-bold text-slate-800">{activeOrg.name}</h2>
          <h3 className="text-base sm:text-lg font-bold text-slate-700 mt-2">{reportTitle}</h3>
          <p className="text-slate-500 text-sm mt-1">
            Periode: {reportData.period.startDate.toLocaleDateString('id-ID')} s.d. {reportData.period.endDate.toLocaleDateString('id-ID')}
          </p>
        </div>

        {/* PENDAPATAN / INFLOWS */}
        <div className="mb-8">
          <h4 className="text-base font-bold text-slate-800 border-b-2 border-slate-300 pb-2 mb-4">
            {isYayasan ? 'ARUS KAS MASUK (INFLOWS)' : 'PENDAPATAN (REVENUES)'}
          </h4>
          
          {reportData.revenues.length === 0 ? (
            <p className="text-slate-500 text-sm ml-4 mb-4">-</p>
          ) : (
            reportData.revenues.map((revenue) => (
              <div key={revenue.code} className="flex justify-between text-sm text-slate-700 mb-2 ml-4">
                <span>{revenue.code} {revenue.name}</span>
                <span className="font-mono">Rp {revenue.balance.toLocaleString('id-ID')}</span>
              </div>
            ))
          )}

          <div className="flex justify-between text-sm font-bold text-slate-800 bg-slate-100 p-3 rounded mt-4">
            <span>{isYayasan ? 'TOTAL ARUS MASUK' : 'TOTAL PENDAPATAN'}</span>
            <span className="font-mono">Rp {totalRevenues.toLocaleString('id-ID')}</span>
          </div>
        </div>

        {/* PENGELUARAN / OUTFLOWS */}
        <div className="mb-8">
          <h4 className="text-base font-bold text-slate-800 border-b-2 border-slate-300 pb-2 mb-4">
            {isYayasan ? 'ARUS KAS KELUAR (OUTFLOWS)' : 'BEBAN (EXPENSES)'}
          </h4>

          {/* Operating / Program Expenses */}
          {reportData.operatingExpenses.length > 0 && (
            <div className="mb-6">
              <div className="font-bold text-slate-700 mb-2">
                {isYayasan ? 'Program & Kegiatan:' : 'Beban Operasional:'}
              </div>
              {reportData.operatingExpenses.map((expense) => (
                <div key={expense.code} className="flex justify-between text-sm text-slate-700 mb-1 ml-4">
                  <span>{expense.code} {expense.name}</span>
                  <span className="font-mono">Rp {expense.balance.toLocaleString('id-ID')}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-semibold text-slate-800 mt-2 ml-4 pt-2 border-t border-slate-200">
                <span>Subtotal</span>
                <span className="font-mono">Rp {totalOperatingExpenses.toLocaleString('id-ID')}</span>
              </div>
            </div>
          )}

          {/* Administrative Expenses */}
          {reportData.administrativeExpenses.length > 0 && (
            <div className="mb-6">
              <div className="font-bold text-slate-700 mb-2">Beban Administrasi:</div>
              {reportData.administrativeExpenses.map((expense) => (
                <div key={expense.code} className="flex justify-between text-sm text-slate-700 mb-1 ml-4">
                  <span>{expense.code} {expense.name}</span>
                  <span className="font-mono">Rp {expense.balance.toLocaleString('id-ID')}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-semibold text-slate-800 mt-2 ml-4 pt-2 border-t border-slate-200">
                <span>Subtotal</span>
                <span className="font-mono">Rp {totalAdminExpenses.toLocaleString('id-ID')}</span>
              </div>
            </div>
          )}

          {/* Other Expenses */}
          {reportData.otherExpenses.length > 0 && (
            <div className="mb-6">
              <div className="font-bold text-slate-700 mb-2">Beban Lainnya:</div>
              {reportData.otherExpenses.map((expense) => (
                <div key={expense.code} className="flex justify-between text-sm text-slate-700 mb-1 ml-4">
                  <span>{expense.code} {expense.name}</span>
                  <span className="font-mono">Rp {expense.balance.toLocaleString('id-ID')}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-semibold text-slate-800 mt-2 ml-4 pt-2 border-t border-slate-200">
                <span>Subtotal</span>
                <span className="font-mono">Rp {totalOtherExpenses.toLocaleString('id-ID')}</span>
              </div>
            </div>
          )}

          <div className="flex justify-between text-sm font-bold text-slate-800 bg-slate-100 p-3 rounded">
            <span>{isYayasan ? 'TOTAL ARUS KELUAR' : 'TOTAL BEBAN'}</span>
            <span className="font-mono">Rp {totalExpenses.toLocaleString('id-ID')}</span>
          </div>
        </div>

        {/* NET RESULT */}
        <div className={`flex justify-between text-lg sm:text-xl font-bold p-4 rounded ${netResult >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          <span>{resultLabel}</span>
          <span className="font-mono">Rp {netResult.toLocaleString('id-ID')}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs sm:text-sm text-slate-500">
        <p>Laporan ini disusun sesuai dengan Standar Akuntansi Keuangan (SAK) Indonesia</p>
        <p className="mt-2">Dicetak pada {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
    </div>
  )
}
