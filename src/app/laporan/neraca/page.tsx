import { prisma } from "../../../lib/prisma"
import { generateBalanceSheetByDateRange } from "../../../lib/periodic-financial-reports"
import { formatDateRange, formatInputDate, resolveDateRange } from "../../../lib/date-range"
import { buildOrganizationAddressLines } from "../../../lib/branding"
import { buildBalanceSheetWhatsappText } from "../../../lib/report-whatsapp"
import ReportActionButtons from "../../../components/reports/ReportActionButtons"
import { requireModuleAccess } from "../../../lib/auth"

type BalanceSheetPageProps = {
  searchParams?: Promise<{
    startDate?: string
    endDate?: string
  }>
}

export default async function NercaPage({ searchParams }: BalanceSheetPageProps) {
  const { organization } = await requireModuleAccess("balanceSheet")
  const activeOrg = await prisma.organization.findUnique({
    where: { id: organization.id },
    include: {
      accounts: { include: { journalItems: true } }
    }
  })

  if (!activeOrg) {
    return (
      <div className="max-w-full lg:max-w-6xl mx-auto px-4 sm:px-0">
        <h1 className="text-2xl font-bold text-slate-800">Laporan Neraca</h1>
        <p className="text-slate-500 mt-2">Belum ada organisasi. Silakan buat organisasi terlebih dahulu.</p>
      </div>
    )
  }

  const params = searchParams ? await searchParams : {}
  const { startDate, endDate } = resolveDateRange(params)

  const balanceSheetData = await generateBalanceSheetByDateRange(
    activeOrg.id,
    endDate,
    (activeOrg.type as 'YAYASAN' | 'PERUSAHAAN') || 'PERUSAHAAN',
    startDate
  )

  const totalCurrentAssets = balanceSheetData.assets.current.reduce((sum, a) => sum + a.balance, 0)
  const totalFixedAssets = balanceSheetData.assets.fixed.reduce((sum, a) => sum + a.balance, 0)
  const totalAssets = balanceSheetData.totalAssets

  const totalCurrentLiabilities = balanceSheetData.liabilities.current.reduce((sum, l) => sum + l.balance, 0)
  const totalLongTermLiabilities = balanceSheetData.liabilities.longTerm.reduce((sum, l) => sum + l.balance, 0)
  const totalLiabilities = balanceSheetData.totalLiabilities

  const totalEquity = balanceSheetData.totalEquity
  const addressLines = buildOrganizationAddressLines(activeOrg)
  const pdfUrl = `/api/${activeOrg.id}/reports/neraca/pdf?startDate=${formatInputDate(startDate)}&endDate=${formatInputDate(endDate)}`
  const whatsappText = buildBalanceSheetWhatsappText(balanceSheetData, {
    name: activeOrg.name,
    addressLines,
    label: `Nama ${activeOrg.type === "YAYASAN" ? "Yayasan" : "Perusahaan"}`,
    type: activeOrg.type,
  })

  return (
    <div className="max-w-full lg:max-w-4xl mx-auto px-4 sm:px-0 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Laporan Neraca (SAK Indonesia)</h1>
          <p className="text-slate-500 text-sm mt-1">{activeOrg.name} - Periode {formatDateRange(balanceSheetData.period.startDate, balanceSheetData.period.endDate)}</p>
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

      <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${balanceSheetData.balanced ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
        {balanceSheetData.balanced
          ? 'Neraca seimbang. Saldo laba tahun berjalan sudah ikut diperhitungkan pada ekuitas.'
          : `Neraca belum seimbang. Selisih saat ini Rp ${balanceSheetData.balanceDifference.toLocaleString('id-ID')}.`}
      </div>

      {/* Balance Sheet Report */}
      <div id="report-content" className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 overflow-x-auto">
        <div className="mb-8 text-center">
          <h2 className="text-lg sm:text-xl font-bold text-slate-800">{activeOrg.name}</h2>
          <h3 className="text-base sm:text-lg font-bold text-slate-700 mt-2">LAPORAN NERACA (BALANCE SHEET)</h3>
          <p className="text-slate-500 text-sm mt-1">Per {balanceSheetData.period.endDate.toLocaleDateString('id-ID')}</p>
        </div>

        {/* AKTIVA (ASSETS) */}
        <div className="mb-8">
          <h4 className="text-base font-bold text-slate-800 border-b-2 border-slate-300 pb-2 mb-4">AKTIVA (ASET)</h4>

          {/* Aktiva Lancar */}
          <div className="mb-6">
            <div className="font-bold text-slate-700 mb-2">Aktiva Lancar:</div>
            {balanceSheetData.assets.current.length === 0 ? (
              <p className="text-slate-500 text-sm ml-4">-</p>
            ) : (
              balanceSheetData.assets.current.map(asset => (
                <div key={asset.code} className="flex justify-between text-sm text-slate-700 mb-1 ml-4">
                  <span>{asset.code} {asset.name}</span>
                  <span className="font-mono">Rp {asset.balance.toLocaleString('id-ID')}</span>
                </div>
              ))
            )}
            <div className="flex justify-between text-sm font-bold text-slate-800 mt-2 ml-4 pt-2 border-t border-slate-200">
              <span>Total Aktiva Lancar</span>
              <span className="font-mono">Rp {totalCurrentAssets.toLocaleString('id-ID')}</span>
            </div>
          </div>

          {/* Aktiva Tetap */}
          <div className="mb-6">
            <div className="font-bold text-slate-700 mb-2">Aktiva Tetap:</div>
            {balanceSheetData.assets.fixed.length === 0 ? (
              <p className="text-slate-500 text-sm ml-4">-</p>
            ) : (
              balanceSheetData.assets.fixed.map(asset => (
                <div key={asset.code} className="flex justify-between text-sm text-slate-700 mb-1 ml-4">
                  <span>{asset.code} {asset.name}</span>
                  <span className="font-mono">Rp {asset.balance.toLocaleString('id-ID')}</span>
                </div>
              ))
            )}
            <div className="flex justify-between text-sm font-bold text-slate-800 mt-2 ml-4 pt-2 border-t border-slate-200">
              <span>Total Aktiva Tetap</span>
              <span className="font-mono">Rp {totalFixedAssets.toLocaleString('id-ID')}</span>
            </div>
          </div>

          {/* Total Aktiva */}
          <div className="flex justify-between text-base font-bold text-slate-800 bg-slate-100 p-3 rounded">
            <span>TOTAL AKTIVA</span>
            <span className="font-mono">Rp {totalAssets.toLocaleString('id-ID')}</span>
          </div>
        </div>

        {/* PASSIVA (LIABILITIES & EQUITY) */}
        <div>
          <h4 className="text-base font-bold text-slate-800 border-b-2 border-slate-300 pb-2 mb-4">PASSIVA (KEWAJIBAN & EKUITAS)</h4>

          {/* Kewajiban Lancar */}
          <div className="mb-6">
            <div className="font-bold text-slate-700 mb-2">Kewajiban Lancar:</div>
            {balanceSheetData.liabilities.current.length === 0 ? (
              <p className="text-slate-500 text-sm ml-4">-</p>
            ) : (
              balanceSheetData.liabilities.current.map(liability => (
                <div key={liability.code} className="flex justify-between text-sm text-slate-700 mb-1 ml-4">
                  <span>{liability.code} {liability.name}</span>
                  <span className="font-mono">Rp {liability.balance.toLocaleString('id-ID')}</span>
                </div>
              ))
            )}
            <div className="flex justify-between text-sm font-bold text-slate-800 mt-2 ml-4 pt-2 border-t border-slate-200">
              <span>Total Kewajiban Lancar</span>
              <span className="font-mono">Rp {totalCurrentLiabilities.toLocaleString('id-ID')}</span>
            </div>
          </div>

          {/* Kewajiban Jangka Panjang */}
          <div className="mb-6">
            <div className="font-bold text-slate-700 mb-2">Kewajiban Jangka Panjang:</div>
            {balanceSheetData.liabilities.longTerm.length === 0 ? (
              <p className="text-slate-500 text-sm ml-4">-</p>
            ) : (
              balanceSheetData.liabilities.longTerm.map(liability => (
                <div key={liability.code} className="flex justify-between text-sm text-slate-700 mb-1 ml-4">
                  <span>{liability.code} {liability.name}</span>
                  <span className="font-mono">Rp {liability.balance.toLocaleString('id-ID')}</span>
                </div>
              ))
            )}
            <div className="flex justify-between text-sm font-bold text-slate-800 mt-2 ml-4 pt-2 border-t border-slate-200">
              <span>Total Kewajiban Jangka Panjang</span>
              <span className="font-mono">Rp {totalLongTermLiabilities.toLocaleString('id-ID')}</span>
            </div>
          </div>

          {/* Total Kewajiban */}
          <div className="flex justify-between text-sm font-bold text-slate-800 bg-slate-50 p-3 rounded mb-6">
            <span>TOTAL KEWAJIBAN</span>
            <span className="font-mono">Rp {totalLiabilities.toLocaleString('id-ID')}</span>
          </div>

          {/* Aset Neto / Ekuitas */}
          <div className="mb-6">
            <div className="font-bold text-slate-700 mb-2">{activeOrg.type === 'YAYASAN' ? 'Aset Neto' : 'Ekuitas'}:</div>
            {balanceSheetData.equity.length === 0 ? (
              <p className="text-slate-500 text-sm ml-4">-</p>
            ) : (
              balanceSheetData.equity.map(eq => (
                <div key={eq.code} className="flex justify-between text-sm text-slate-700 mb-1 ml-4">
                  <span>{eq.code} {eq.name}</span>
                  <span className="font-mono">Rp {eq.balance.toLocaleString('id-ID')}</span>
                </div>
              ))
            )}
            <div className="flex justify-between text-sm font-bold text-slate-800 mt-2 ml-4 pt-2 border-t border-slate-200">
              <span>Total {activeOrg.type === 'YAYASAN' ? 'Aset Neto' : 'Ekuitas'}</span>
              <span className="font-mono">Rp {totalEquity.toLocaleString('id-ID')}</span>
            </div>
          </div>

          {/* Total Passiva */}
            <div className="flex justify-between text-base font-bold text-slate-800 bg-slate-100 p-3 rounded">
            <span>TOTAL PASSIVA</span>
            <span className="font-mono">Rp {balanceSheetData.totalLiabilitiesAndEquity.toLocaleString('id-ID')}</span>
          </div>
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
