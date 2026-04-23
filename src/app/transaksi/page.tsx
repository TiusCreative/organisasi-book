import Pagination from "../../components/Pagination"
import { ReceiptText, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { prisma } from "../../lib/prisma"
import TransactionModal from "../../components/forms/TransactionModal"
import TransactionActions from "../../components/TransactionActions"
import { formatDateRange, formatInputDate, resolveDateRange } from "../../lib/date-range"
import { requireModuleAccess } from "../../lib/auth"

type TransaksiPageProps = {
  searchParams?: Promise<{
    startDate?: string
    endDate?: string
    query?: string
    page?: string
  }>
}

const PAGE_SIZE = 100

export default async function TransaksiPage({ searchParams }: TransaksiPageProps) {
  const { organization } = await requireModuleAccess("transactions")
  const params = searchParams ? await searchParams : {}
  const { startDate, endDate } = resolveDateRange(params)
  const query = (params.query || "").trim()
  const currentPage = Math.max(1, Number.parseInt(params.page || "1", 10) || 1)
  
  const searchParamsObj = new URLSearchParams()
  if (startDate) searchParamsObj.set("startDate", String(startDate))
  if (endDate) searchParamsObj.set("endDate", String(endDate))
  if (query) searchParamsObj.set("query", query)

  const activeOrg = await prisma.organization.findUnique({
    where: { id: organization.id },
    include: {
      accounts: true,
      banks: {
        include: {
          account: true,
        },
      },
    },
  })

  if (!activeOrg) {
    return (
      <div className="max-w-full lg:max-w-6xl mx-auto px-4 sm:px-0">
        <h1 className="text-2xl font-bold text-slate-800">Riwayat Transaksi</h1>
        <p className="text-slate-500 mt-2">Belum ada organisasi. Silakan buat organisasi terlebih dahulu.</p>
      </div>
    )
  }

  const transactionWhere = {
    organizationId: activeOrg.id,
    date: {
      gte: startDate,
      lte: endDate,
    },
    ...(query
      ? {
          OR: [
            { description: { contains: query, mode: "insensitive" as const } },
            { reference: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  }

  const [transactions, totalTransactions] = await Promise.all([
    prisma.transaction.findMany({
      where: transactionWhere,
      include: {
        lines: {
          include: {
            account: {
              include: {
                category: true,
              },
            },
          },
        },
      },
      orderBy: { date: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.transaction.count({
      where: transactionWhere,
    }),
  ])

  const bankAccountIds = new Set((activeOrg.banks || []).map((bank) => bank.accountId))
  const filteredTotals = transactions.reduce(
    (summary, trx) => {
      const bankLine = trx.lines.find((line) => bankAccountIds.has(line.accountId))
      if (!bankLine) {
        return summary
      }

      summary.count += 1
      summary.income += bankLine.debit || 0
      summary.expense += bankLine.credit || 0
      return summary
    },
    { count: 0, income: 0, expense: 0 }
  )

  const totalPages = Math.max(1, Math.ceil(totalTransactions / PAGE_SIZE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startItem = totalTransactions === 0 ? 0 : (safeCurrentPage - 1) * PAGE_SIZE + 1
  const endItem = totalTransactions === 0 ? 0 : Math.min(safeCurrentPage * PAGE_SIZE, totalTransactions)
  const startDateValue = formatInputDate(startDate)
  const endDateValue = formatInputDate(endDate)

  return (
    <div className="max-w-full lg:max-w-6xl mx-auto px-4 sm:px-0 space-y-6">
      <div className="mb-6">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors">
          <ArrowLeft size={20} />
          <span>Kembali ke Dashboard</span>
        </Link>
      </div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Riwayat Transaksi</h1>
          <p className="text-slate-500 text-sm mt-1">
            Kelola semua transaksi keuangan Anda untuk periode {formatDateRange(startDate, endDate)}
          </p>
        </div>

        <TransactionModal
          org={activeOrg}
          accounts={activeOrg.accounts || []}
          bankAccounts={activeOrg.banks || []}
        />
      </div>

      <form className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <input
          type="date"
          name="startDate"
          defaultValue={startDateValue}
          className="form-field rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <input
          type="date"
          name="endDate"
          defaultValue={endDateValue}
          className="form-field rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <input
          type="text"
          name="query"
          defaultValue={query}
          placeholder="Cari keterangan atau no nota"
          className="form-field rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
          Filter
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Transaksi di Halaman Ini</p>
          <p className="mt-2 text-2xl font-bold text-slate-800">{filteredTotals.count}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Total Masuk</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">Rp {filteredTotals.income.toLocaleString("id-ID")}</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-rose-700">Total Keluar</p>
          <p className="mt-2 text-2xl font-bold text-rose-700">Rp {filteredTotals.expense.toLocaleString("id-ID")}</p>
        </div>
      </div>

      {totalTransactions > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p>
            Menampilkan <span className="font-bold text-slate-800">{startItem}</span> - <span className="font-bold text-slate-800">{endItem}</span> dari{" "}
            <span className="font-bold text-slate-800">{totalTransactions}</span> transaksi
          </p>
          <p className="text-xs text-slate-500">Batas {PAGE_SIZE} item per halaman</p>
        </div>
      ) : null}

      <div className="grid gap-4">
        {transactions.map((trx) => {
          const bankLine = trx.lines.find((line) => bankAccountIds.has(line.accountId))
          const isCashIn = (bankLine?.debit || 0) > 0
          const displayedAmount = bankLine?.debit || bankLine?.credit || 0

          return (
            <div key={trx.id} className="bg-white p-4 sm:p-5 rounded-xl border border-slate-100 shadow-sm hover:border-blue-200 transition-all group">
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded tracking-wider font-mono">
                        {trx.reference}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        {new Date(trx.date).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-700 text-base sm:text-lg">{trx.description}</h3>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className={`text-lg sm:text-xl font-black ${isCashIn ? "text-emerald-600" : "text-rose-600"}`}>
                      {isCashIn ? "+" : "-"} Rp {displayedAmount.toLocaleString("id-ID")}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {trx.lines.map((line, idx) => (
                    <span key={idx} className="text-[10px] sm:text-xs text-slate-400 border border-slate-100 px-2 py-1 rounded flex items-center gap-1">
                      {line.account.category ? (
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: line.account.category.color }}></div>
                      ) : null}
                      {line.account.name}
                    </span>
                  ))}
                </div>

                <div className="flex justify-end">
                  <TransactionActions transaction={trx} accounts={activeOrg.accounts || []} bankAccounts={activeOrg.banks || []} />
                </div>
              </div>
            </div>
          )
        })}

        {transactions.length === 0 ? (
          <div className="text-center py-16 sm:py-24 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <ReceiptText className="text-slate-300" size={32} />
            </div>
            <p className="text-slate-500 font-bold text-lg">Belum Ada Transaksi</p>
            <p className="text-slate-400 text-sm mt-1">Belum ada transaksi pada filter ini. Coba ubah pencarian atau rentang tanggal.</p>
          </div>
        ) : null}
      </div>

      {totalPages > 1 ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            Halaman <span className="font-bold text-slate-800">{safeCurrentPage}</span> dari <span className="font-bold text-slate-800">{totalPages}</span>
          </p>
          <Pagination currentPage={safeCurrentPage} totalPages={totalPages} baseUrl="/transaksi" params={searchParamsObj} />
        </div>
      ) : null}
    </div>
  )
}
