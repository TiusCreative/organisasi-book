import { prisma } from "../../lib/prisma"
import Link from "next/link"
import { 
  ArrowLeft, 
  PieChart, 
  Briefcase, 
  LineChart, 
  BadgePercent, 
  Landmark,
  FileBarChart,
  TrendingUp,
  Wallet,
  FileText,
  Target,
  Boxes,
  ArrowRight
} from "lucide-react"
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
import { hasModulePermission } from "../../lib/permissions"
import { getCurrentUser } from "../../lib/auth"

type ReportPageProps = {
  searchParams?: Promise<{
    startDate?: string
    endDate?: string
  }>
}

export default async function LaporanPage({ searchParams }: ReportPageProps) {
  const { organization } = await requireModuleAccess("reports")
  const currentUser = await getCurrentUser()
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
      <div className="mb-6">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors">
          <ArrowLeft size={20} />
          <span>Kembali ke Dashboard</span>
        </Link>
      </div>
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

      {/* Report Categories */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Laporan Keuangan */}
        {currentUser && hasModulePermission(currentUser, "reportFinancial") && (
          <div className="rounded-2xl border-2 border-blue-100 bg-blue-50/50 p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-blue-100 p-3">
                <PieChart className="text-blue-600" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-blue-900">Laporan Keuangan</h3>
                <p className="text-sm text-blue-700">SAK Indonesia Standard Reports</p>
              </div>
            </div>
            <div className="space-y-2">
              {currentUser && hasModulePermission(currentUser, "balanceSheet") && (
                <Link
                  href={`/laporan/neraca?startDate=${formatInputDate(startDate)}&endDate=${formatInputDate(endDate)}`}
                  className="flex items-center justify-between rounded-lg border border-blue-200 bg-white p-3 hover:bg-blue-50"
                >
                  <div className="flex items-center gap-3">
                    <FileBarChart className="text-blue-500" size={18} />
                    <span className="font-medium text-slate-700">Laporan Neraca</span>
                  </div>
                  <ArrowRight className="text-blue-400" size={16} />
                </Link>
              )}
              {currentUser && hasModulePermission(currentUser, "incomeStatement") && (
                <Link
                  href={`/laporan/laba-rugi?startDate=${formatInputDate(startDate)}&endDate=${formatInputDate(endDate)}`}
                  className="flex items-center justify-between rounded-lg border border-blue-200 bg-white p-3 hover:bg-blue-50"
                >
                  <div className="flex items-center gap-3">
                    <TrendingUp className="text-blue-500" size={18} />
                    <span className="font-medium text-slate-700">
                      {activeOrg.type === 'YAYASAN' ? 'Laporan Aktivitas' : 'Laporan Laba Rugi'}
                    </span>
                  </div>
                  <ArrowRight className="text-blue-400" size={16} />
                </Link>
              )}
              {currentUser && hasModulePermission(currentUser, "cashFlow") && (
                <Link
                  href={`/laporan/cash-flow?startDate=${formatInputDate(startDate)}&endDate=${formatInputDate(endDate)}`}
                  className="flex items-center justify-between rounded-lg border border-blue-200 bg-white p-3 hover:bg-blue-50"
                >
                  <div className="flex items-center gap-3">
                    <Wallet className="text-blue-500" size={18} />
                    <span className="font-medium text-slate-700">Cash Flow Statement</span>
                  </div>
                  <ArrowRight className="text-blue-400" size={16} />
                </Link>
              )}
              {currentUser && hasModulePermission(currentUser, "equityChange") && (
                <Link
                  href={`/laporan/perubahan-modal?startDate=${formatInputDate(startDate)}&endDate=${formatInputDate(endDate)}`}
                  className="flex items-center justify-between rounded-lg border border-blue-200 bg-white p-3 hover:bg-blue-50"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="text-blue-500" size={18} />
                    <span className="font-medium text-slate-700">Perubahan Modal</span>
                  </div>
                  <ArrowRight className="text-blue-400" size={16} />
                </Link>
              )}
              {currentUser && hasModulePermission(currentUser, "retainedEarnings") && (
                <Link
                  href={`/laporan/laba-ditahan?startDate=${formatInputDate(startDate)}&endDate=${formatInputDate(endDate)}`}
                  className="flex items-center justify-between rounded-lg border border-blue-200 bg-white p-3 hover:bg-blue-50"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="text-blue-500" size={18} />
                    <span className="font-medium text-slate-700">Retained Earnings</span>
                  </div>
                  <ArrowRight className="text-blue-400" size={16} />
                </Link>
              )}
              {currentUser && hasModulePermission(currentUser, "reservesDistribution") && (
                <Link
                  href={`/laporan/cadangan-distribusi?startDate=${formatInputDate(startDate)}&endDate=${formatInputDate(endDate)}`}
                  className="flex items-center justify-between rounded-lg border border-blue-200 bg-white p-3 hover:bg-blue-50"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="text-blue-500" size={18} />
                    <span className="font-medium text-slate-700">Cadangan & Distribusi</span>
                  </div>
                  <ArrowRight className="text-blue-400" size={16} />
                </Link>
              )}
              {currentUser && hasModulePermission(currentUser, "generalLedger") && (
                <Link
                  href={`/laporan/buku-besar?startDate=${formatInputDate(startDate)}&endDate=${formatInputDate(endDate)}`}
                  className="flex items-center justify-between rounded-lg border border-blue-200 bg-white p-3 hover:bg-blue-50"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="text-blue-500" size={18} />
                    <span className="font-medium text-slate-700">Buku Besar</span>
                  </div>
                  <ArrowRight className="text-blue-400" size={16} />
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Laporan Operasional */}
        {currentUser && hasModulePermission(currentUser, "reportOperational") && (
          <div className="rounded-2xl border-2 border-emerald-100 bg-emerald-50/50 p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-emerald-100 p-3">
                <Briefcase className="text-emerald-600" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-emerald-900">Laporan Operasional</h3>
                <p className="text-sm text-emerald-700">AR/AP, Sales, Inventory, PO</p>
              </div>
            </div>
            <div className="space-y-2">
              {currentUser && hasModulePermission(currentUser, "arap") && (
                <Link
                  href={`/laporan/arap?startDate=${formatInputDate(startDate)}&endDate=${formatInputDate(endDate)}`}
                  className="flex items-center justify-between rounded-lg border border-emerald-200 bg-white p-3 hover:bg-emerald-50"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="text-emerald-500" size={18} />
                    <span className="font-medium text-slate-700">Laporan AR/AP</span>
                  </div>
                  <ArrowRight className="text-emerald-400" size={16} />
                </Link>
              )}
              {currentUser && hasModulePermission(currentUser, "reportPurchase") && (
                <Link
                  href={`/laporan/po?startDate=${formatInputDate(startDate)}&endDate=${formatInputDate(endDate)}`}
                  className="flex items-center justify-between rounded-lg border border-emerald-200 bg-white p-3 hover:bg-emerald-50"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="text-emerald-500" size={18} />
                    <span className="font-medium text-slate-700">Purchase Order</span>
                  </div>
                  <ArrowRight className="text-emerald-400" size={16} />
                </Link>
              )}
              {currentUser && hasModulePermission(currentUser, "reportSales") && (
                <Link
                  href="/sales"
                  className="flex items-center justify-between rounded-lg border border-emerald-200 bg-white p-3 hover:bg-emerald-50"
                >
                  <div className="flex items-center gap-3">
                    <Target className="text-emerald-500" size={18} />
                    <span className="font-medium text-slate-700">Sales & Marketing</span>
                  </div>
                  <ArrowRight className="text-emerald-400" size={16} />
                </Link>
              )}
              {currentUser && hasModulePermission(currentUser, "reportInventory") && (
                <Link
                  href="/inventory"
                  className="flex items-center justify-between rounded-lg border border-emerald-200 bg-white p-3 hover:bg-emerald-50"
                >
                  <div className="flex items-center gap-3">
                    <Boxes className="text-emerald-500" size={18} />
                    <span className="font-medium text-slate-700">Inventory & Gudang</span>
                  </div>
                  <ArrowRight className="text-emerald-400" size={16} />
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Laporan Aset & Investasi */}
        {currentUser && hasModulePermission(currentUser, "reportAssets") && (
          <div className="rounded-2xl border-2 border-amber-100 bg-amber-50/50 p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-amber-100 p-3">
                <LineChart className="text-amber-600" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-amber-900">Aset & Investasi</h3>
                <p className="text-sm text-amber-700">Aset Tetap, Aset Tak Berwujud, Investasi</p>
              </div>
            </div>
            <div className="space-y-2">
              {currentUser && hasModulePermission(currentUser, "intangibleAssets") && (
                <Link
                  href="/laporan/aset-tak-berwujud"
                  className="flex items-center justify-between rounded-lg border border-amber-200 bg-white p-3 hover:bg-amber-50"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="text-amber-500" size={18} />
                    <span className="font-medium text-slate-700">Aset Tak Berwujud</span>
                  </div>
                  <ArrowRight className="text-amber-400" size={16} />
                </Link>
              )}
              {currentUser && hasModulePermission(currentUser, "investmentReport") && (
                <Link
                  href={`/laporan/investasi?startDate=${formatInputDate(startDate)}&endDate=${formatInputDate(endDate)}`}
                  className="flex items-center justify-between rounded-lg border border-amber-200 bg-white p-3 hover:bg-amber-50"
                >
                  <div className="flex items-center gap-3">
                    <LineChart className="text-amber-500" size={18} />
                    <span className="font-medium text-slate-700">Laporan Investasi</span>
                  </div>
                  <ArrowRight className="text-amber-400" size={16} />
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Laporan Pajak & Bank */}
        <div className="grid gap-6">
          {currentUser && hasModulePermission(currentUser, "reportTax") && (
            <div className="rounded-2xl border-2 border-rose-100 bg-rose-50/50 p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl bg-rose-100 p-3">
                  <BadgePercent className="text-rose-600" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-rose-900">Laporan Pajak</h3>
                  <p className="text-sm text-rose-700">PPh 21, PPh 23, PPN</p>
                </div>
              </div>
              {currentUser && hasModulePermission(currentUser, "taxes") && (
                <Link
                  href={`/pajak?startDate=${formatInputDate(startDate)}&endDate=${formatInputDate(endDate)}`}
                  className="flex items-center justify-between rounded-lg border border-rose-200 bg-white p-3 hover:bg-rose-50"
                >
                  <div className="flex items-center gap-3">
                    <BadgePercent className="text-rose-500" size={18} />
                    <span className="font-medium text-slate-700">Laporan Pajak</span>
                  </div>
                  <ArrowRight className="text-rose-400" size={16} />
                </Link>
              )}
            </div>
          )}

          {currentUser && hasModulePermission(currentUser, "reportBank") && (
            <div className="rounded-2xl border-2 border-slate-100 bg-slate-50/50 p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl bg-slate-100 p-3">
                  <Landmark className="text-slate-600" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Laporan Bank</h3>
                  <p className="text-sm text-slate-700">Rekening Bank & Reconciliation</p>
                </div>
              </div>
              {currentUser && hasModulePermission(currentUser, "bankReport") && (
                <Link
                  href={`/laporan/bank?startDate=${formatInputDate(startDate)}&endDate=${formatInputDate(endDate)}`}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <Landmark className="text-slate-500" size={18} />
                    <span className="font-medium text-slate-700">Rekening Bank</span>
                  </div>
                  <ArrowRight className="text-slate-400" size={16} />
                </Link>
              )}
            </div>
          )}
        </div>
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
