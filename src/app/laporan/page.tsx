import { prisma } from "../../lib/prisma"
import Link from "next/link"
import { 
  generateTransactionReport,
  generateBankReport,
  generateIncomeReport,
  generateExpenseReport,
  generateProfitLossReport,
  generateGeneralLedger
} from "../../lib/report-utils"
import ReportViewer from "../../components/reports/ReportViewer"
import { formatDateRange, formatInputDate, resolveDateRange } from "../../lib/date-range"
import { buildOrganizationAddressLines } from "../../lib/branding"
import { requireModuleAccess } from "../../lib/auth"

type ReportPageProps = {
  searchParams?: Promise<{
    startDate?: string
    endDate?: string
  }>
}

export default async function LaporanPage({ searchParams }: ReportPageProps) {
  const { organization } = await requireModuleAccess("reports")
  const params = searchParams ? await searchParams : {}
  const { startDate, endDate } = resolveDateRange(params)
  const activeOrg = await prisma.organization.findUnique({
    where: { id: organization.id },
    include: {
      accounts: {
        include: {
          journalItems: {
            where: {
              transaction: {
                date: {
                  gte: startDate,
                  lte: endDate,
                },
              },
            },
          },
        },
      },
      banks: true,
      transactions: {
        where: {
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: { lines: { include: { account: true } } },
        orderBy: { date: 'desc' },
      }
    }
  })

  if (!activeOrg) {
    return (
      <div className="max-w-full lg:max-w-6xl mx-auto px-4 sm:px-0">
        <h1 className="text-2xl font-bold text-slate-800">Laporan Keuangan</h1>
        <p className="text-slate-500 mt-2">Belum ada organisasi. Silakan buat organisasi terlebih dahulu.</p>
      </div>
    )
  }

  // Generate semua report
  const bankAccountIds = new Set((activeOrg.banks || []).map((bank) => bank.accountId))
  const transactionReport = generateTransactionReport(activeOrg.transactions, startDate, endDate, bankAccountIds)
  const bankReport = generateBankReport(activeOrg.banks, startDate, endDate)
  const incomeReport = generateIncomeReport(activeOrg.transactions, startDate, endDate, bankAccountIds)
  const expenseReport = generateExpenseReport(activeOrg.transactions, startDate, endDate, bankAccountIds)
  const profitLossReport = generateProfitLossReport(activeOrg.transactions, activeOrg, startDate, endDate, bankAccountIds)
  const generalLedger = generateGeneralLedger(activeOrg.accounts, startDate, endDate)
  const orgBranding = {
    name: activeOrg.name,
    addressLines: buildOrganizationAddressLines(activeOrg),
  }

  return (
    <div className="max-w-full lg:max-w-6xl mx-auto px-4 sm:px-0 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">Laporan Keuangan</h1>
        <p className="text-slate-500 text-sm mt-1">{activeOrg.name} - {formatDateRange(startDate, endDate)}</p>
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

      {/* SAK Indonesia Standard Reports */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          href={`/laporan/neraca?startDate=${formatInputDate(startDate)}&endDate=${formatInputDate(endDate)}`}
          className="p-6 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer"
        >
          <h3 className="text-lg font-bold text-blue-900">Laporan Neraca</h3>
          <p className="text-sm text-blue-700 mt-2">SAK Indonesia - Balance Sheet sesuai standar</p>
        </Link>

        <Link
          href={`/laporan/laba-rugi?startDate=${formatInputDate(startDate)}&endDate=${formatInputDate(endDate)}`}
          className="p-6 rounded-xl border-2 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors cursor-pointer"
        >
          <h3 className="text-lg font-bold text-emerald-900">
            {activeOrg.type === 'YAYASAN' ? 'Laporan Aktivitas' : 'Laporan Laba Rugi'}
          </h3>
          <p className="text-sm text-emerald-700 mt-2">SAK Indonesia - {activeOrg.type === 'YAYASAN' ? 'Activity Report' : 'Income Statement'}</p>
        </Link>

        <Link
          href={`/laporan/cash-flow?startDate=${formatInputDate(startDate)}&endDate=${formatInputDate(endDate)}`}
          className="p-6 rounded-xl border-2 border-purple-200 bg-purple-50 hover:bg-purple-100 transition-colors cursor-pointer"
        >
          <h3 className="text-lg font-bold text-purple-900">Cash Flow Statement</h3>
          <p className="text-sm text-purple-700 mt-2">Laporan arus kas operasional, investasi, dan financing</p>
        </Link>

        <Link
          href={`/laporan/investasi?startDate=${formatInputDate(startDate)}&endDate=${formatInputDate(endDate)}`}
          className="p-6 rounded-xl border-2 border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer"
        >
          <h3 className="text-lg font-bold text-amber-900">Laporan Investasi</h3>
          <p className="text-sm text-amber-700 mt-2">Filter portofolio, nilai buku, dan keuntungan/rugi investasi</p>
        </Link>

        <Link
          href={`/pajak?startDate=${formatInputDate(startDate)}&endDate=${formatInputDate(endDate)}`}
          className="p-6 rounded-xl border-2 border-rose-200 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer"
        >
          <h3 className="text-lg font-bold text-rose-900">Laporan Pajak</h3>
          <p className="text-sm text-rose-700 mt-2">PPh 21, PPh 23, dan PPN per periode dengan catatan otomatis.</p>
        </Link>

        <Link
          href={`/laporan/arap?startDate=${formatInputDate(startDate)}&endDate=${formatInputDate(endDate)}`}
          className="p-6 rounded-xl border-2 border-teal-200 bg-teal-50 hover:bg-teal-100 transition-colors cursor-pointer"
        >
          <h3 className="text-lg font-bold text-teal-900">Laporan AR/AP</h3>
          <p className="text-sm text-teal-700 mt-2">Laporan Account Receivable dan Account Payable (Invoice & Vendor Bill)</p>
        </Link>

        <Link
          href={`/laporan/po?startDate=${formatInputDate(startDate)}&endDate=${formatInputDate(endDate)}`}
          className="p-6 rounded-xl border-2 border-indigo-200 bg-indigo-50 hover:bg-indigo-100 transition-colors cursor-pointer"
        >
          <h3 className="text-lg font-bold text-indigo-900">Laporan Purchase Order</h3>
          <p className="text-sm text-indigo-700 mt-2">Laporan Purchase Order dengan status dan supplier</p>
        </Link>

        <Link
          href="/sales"
          className="p-6 rounded-xl border-2 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors cursor-pointer"
        >
          <h3 className="text-lg font-bold text-emerald-900">Laporan Sales / Marketing</h3>
          <p className="text-sm text-emerald-700 mt-2">Sales Order, Delivery Order, Invoice, komisi + cetak/WA/PDF.</p>
        </Link>

        <Link
          href="/inventory"
          className="p-6 rounded-xl border-2 border-sky-200 bg-sky-50 hover:bg-sky-100 transition-colors cursor-pointer"
        >
          <h3 className="text-lg font-bold text-sky-900">Laporan Gudang & Stock Opname</h3>
          <p className="text-sm text-sky-700 mt-2">Multi-warehouse, barcode, mutasi stok, stock opname + cetak/WA/PDF.</p>
        </Link>
      </div>

      <ReportViewer
        reports={{
          transactions: { data: transactionReport, type: 'transactions' },
          bank: { data: bankReport, type: 'bank' },
          income: { data: incomeReport, type: 'income' },
          expense: { data: expenseReport, type: 'expense' },
          profitLoss: { data: profitLossReport, type: 'profit_loss' },
          generalLedger: { data: generalLedger, type: 'general_ledger' }
        }}
        orgName={activeOrg.name}
        orgId={activeOrg.id}
        orgAddressLines={orgBranding.addressLines}
        startDate={formatInputDate(startDate)}
        endDate={formatInputDate(endDate)}
      />
    </div>
  )
}
