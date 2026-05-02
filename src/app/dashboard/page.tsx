import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Wallet, Landmark, TrendingUp, TrendingDown, FileText, Plus, Users, Package, Receipt, Store } from "lucide-react"
import TransactionModal from "@/components/forms/TransactionModal"
import { requireModuleAccess } from "@/lib/auth"

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { organization } = await requireModuleAccess("dashboard")
  let activeOrg

  try {
    activeOrg = await prisma.organization.findUnique({
      where: { id: organization.id },
      include: {
        accounts: true,
        banks: true,
        transactions: {
          include: { lines: true },
          orderBy: { date: 'desc' },
          },
          // Tarik data penjualan POS untuk grafik (7 hari terakhir)
          posSales: {
            where: {
              createdAt: {
                gte: new Date(new Date().setDate(new Date().getDate() - 7))
              }
            },
            orderBy: { createdAt: 'asc' }
        }
      }
    })
  } catch (error) {
    console.error("Dashboard: Error fetching organization:", error)
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-rose-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-3xl border border-amber-200 bg-white p-8 shadow-xl">
          <h1 className="text-2xl font-bold text-amber-800 mb-4">Terjadi Kesalahan</h1>
          <p className="text-slate-600 mb-6">Gagal memuat data organisasi. Silakan coba lagi atau hubungi administrator.</p>
          <div className="mt-6 flex gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Coba Lagi
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Logout
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!activeOrg) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-emerald-50 flex items-center justify-center p-4">
        <div className="text-center max-w-lg">
          <div className="mb-8">
            <Package size={64} className="mx-auto text-blue-600 mb-4" />
            <h1 className="text-4xl font-bold text-slate-800 mb-4">Selamat Datang!</h1>
            <p className="text-slate-600 mb-8 text-lg">
              Sistem Akuntansi & Keuangan untuk Organisasi Anda
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
            <p className="text-slate-600 mb-6">
              Anda belum memiliki organisasi. Silakan buat organisasi terlebih dahulu untuk memulai.
            </p>
            <Link
              href="/register"
              className="inline-block w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold py-4 px-8 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all"
            >
              <Plus size={20} className="inline mr-2" />
              Buat Organisasi Baru
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Calculate metrics from actual transactions
  let totalCash = 0
  let totalBank = 0
  let monthlyIncome = 0
  let monthlyExpense = 0
  let recentTransactions: Array<{
    id: string
    description: string
    date: Date
    lines: Array<{ debit: number; credit: number }>
  }> = []

  if (activeOrg && activeOrg.transactions) {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    recentTransactions = activeOrg.transactions.slice(0, 5)

    // Calculate monthly totals
    activeOrg.transactions.forEach(tx => {
      if (tx.date.getMonth() === currentMonth && tx.date.getFullYear() === currentYear) {
        tx.lines.forEach(line => {
          if (line.debit > 0) monthlyIncome += line.debit
          if (line.credit > 0) monthlyExpense += line.credit
        })
      }
    })

    // Get cash and bank balances
    const cashAccount = activeOrg.accounts.find(a => a.code?.startsWith('1001'))
    const bankAccounts = activeOrg.accounts.filter(a => a.code?.startsWith('1002'))

    if (cashAccount) {
      activeOrg.transactions.forEach(tx => {
        tx.lines.forEach(line => {
          if (line.accountId === cashAccount.id) {
            totalCash += (line.debit - line.credit)
          }
        })
      })
    }

    bankAccounts.forEach(account => {
      activeOrg.transactions.forEach(tx => {
        tx.lines.forEach(line => {
          if (line.accountId === account.id) {
            totalBank += (line.debit - line.credit)
          }
        })
      })
    })
  }

  // Menyiapkan Data Grafik Pendapatan POS Harian
  const posChartData = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      dateLabel: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      total: 0,
      rawDate: d.toISOString().split('T')[0]
    };
  });

  if (activeOrg?.posSales) {
    activeOrg.posSales.forEach((sale) => {
      const saleDate = new Date(sale.createdAt).toISOString().split('T')[0];
      const point = posChartData.find((p) => p.rawDate === saleDate);
      if (point) point.total += sale.total;
    });
  }
  const maxPosTotal = Math.max(...posChartData.map(d => d.total), 1); // Hindari pembagian nol
  const totalPosSevenDays = posChartData.reduce((sum, day) => sum + day.total, 0)
  const todayKey = new Date().toISOString().split('T')[0]
  const todayPosTotal = posChartData.find((day) => day.rawDate === todayKey)?.total || 0

  return (
    <div className="max-w-full lg:max-w-6xl mx-auto px-4 sm:px-0 space-y-8">
      {/* HEADER DASHBOARD */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-800">Ringkasan Keuangan</h1>
          <p className="text-slate-500 mt-1 text-sm sm:text-base">Pantau arus kas dan performa organisasi Anda hari ini.</p>
        </div>
        <div className="px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm font-medium text-slate-700 text-sm sm:text-base">
          {activeOrg?.name || "Memuat..."}
        </div>
      </div>

      {/* QUICK ACTION BUTTONS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <TransactionModal 
          org={activeOrg} 
          accounts={activeOrg?.accounts || []}
          bankAccounts={activeOrg?.banks || []}
          buttonClassName="w-full flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-bold text-xs sm:text-sm"
          buttonText={<><Plus size={18} /> Transaksi</>}
        />

        <Link
          href="/gaji/tambah"
          className="w-full flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold text-xs sm:text-sm"
        >
          <Users size={18} /> Gaji
        </Link>

        <Link
          href="/aset/tambah"
          className="w-full flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-bold text-xs sm:text-sm"
        >
          <Package size={18} /> Aset
        </Link>

        <Link
          href="/laporan"
          className="w-full flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-bold text-xs sm:text-sm"
        >
          <Receipt size={18} /> Laporan
        </Link>
      </div>

      {/* KARTU METRIK */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
              <Wallet size={24} />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500 mb-1">Saldo Kas Kecil</p>
          <h3 className="text-2xl font-bold text-slate-800">
            {totalCash === 0 ? 'Rp 0' : `Rp ${totalCash.toLocaleString('id-ID')}`}
          </h3>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
              <Landmark size={24} />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500 mb-1">Total Saldo Bank</p>
          <h3 className="text-2xl font-bold text-slate-800">
            {totalBank === 0 ? 'Rp 0' : `Rp ${totalBank.toLocaleString('id-ID')}`}
          </h3>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
              <TrendingUp size={24} />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500 mb-1">Pemasukan (Bulan Ini)</p>
          <h3 className="text-2xl font-bold text-slate-800">
            {monthlyIncome === 0 ? 'Rp 0' : `Rp ${monthlyIncome.toLocaleString('id-ID')}`}
          </h3>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-rose-50 rounded-lg text-rose-600">
              <TrendingDown size={24} />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500 mb-1">Pengeluaran (Bulan Ini)</p>
          <h3 className="text-2xl font-bold text-slate-800">
            {monthlyExpense === 0 ? 'Rp 0' : `Rp ${monthlyExpense.toLocaleString('id-ID')}`}
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* WIDGET GRAFIK PENJUALAN POS (7 HARI) */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-slate-100 shadow-sm p-5 sm:p-6 flex flex-col h-full">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
                  <Store size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">POS Kasir</h2>
                  <p className="text-xs text-slate-500">Pendapatan 7 hari terakhir</p>
                </div>
              </div>
              <Link
                href="/pos"
                className="inline-flex shrink-0 items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
              >
                Buka POS
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Hari ini</p>
                <p className="mt-1 text-base font-bold text-slate-800">
                  Rp {todayPosTotal.toLocaleString('id-ID')}
                </p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">7 hari</p>
                <p className="mt-1 text-base font-bold text-slate-800">
                  Rp {totalPosSevenDays.toLocaleString('id-ID')}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex h-44 items-end gap-2 border-b border-slate-100 pb-3">
            {posChartData.map((data, idx) => {
              const heightPercent = Math.round((data.total / maxPosTotal) * 100) || 2;
              return (
                <div key={idx} className="flex-1 flex flex-col justify-end items-center group relative">
                  {/* Tooltip Hover */}
                  <div className="absolute -top-8 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none z-10">
                    Rp {data.total.toLocaleString('id-ID')}
                  </div>
                  {/* Bar Chart */}
                  <div 
                    className="w-full bg-blue-200 hover:bg-blue-400 rounded-t-sm transition-all" 
                    style={{ height: `${heightPercent}%`, minHeight: '4px' }}
                  ></div>
                  <span className="text-[10px] text-slate-400 mt-2 truncate w-full text-center">{data.dateLabel.split(' ')[0]}</span>
                </div>
              )
            })}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link
              href="/pos/products"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Produk POS
            </Link>
            <Link
              href="/pos/reports"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Laporan POS
            </Link>
          </div>
        </div>

        {/* AREA TRANSAKSI TERAKHIR */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-800">Transaksi Terakhir</h2>
            {recentTransactions.length > 0 && (
              <Link href="/transaksi" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                Lihat Semua
              </Link>
            )}
          </div>

          {recentTransactions.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center justify-center text-slate-500">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-400">
                <FileText size={32} />
              </div>
              <p className="font-medium text-slate-600">Belum ada transaksi</p>
              <p className="text-sm mt-1 mb-4">Mulai catat pemasukan dan pengeluaran Anda.</p>
              <TransactionModal 
                org={activeOrg} 
                accounts={activeOrg?.accounts || []}
                bankAccounts={activeOrg?.banks || []}
                buttonClassName="px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
                buttonText={<><Plus size={18} /> Buat Transaksi Baru</>}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <tbody>
                  {recentTransactions.map((tx, idx) => (
                    <tr key={tx.id} className={idx > 0 ? 'border-t border-slate-100' : ''}>
                      <td className="p-6">
                        <p className="font-medium text-slate-800">{tx.description}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(tx.date).toLocaleDateString('id-ID', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                      </td>
                      <td className="p-6 text-right">
                        <p className="font-bold text-slate-800">
                          Rp {tx.lines.reduce((sum: number, l) => sum + (l.debit || l.credit), 0).toLocaleString('id-ID')}
                        </p>
                      </td>
                      <td className="p-6 text-right">
                        <Link
                          href={`/transaksi/${tx.id}`}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Lihat
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
