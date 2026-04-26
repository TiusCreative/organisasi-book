"use client"

import { useState, useEffect } from "react"
import { Plus, Wallet, Landmark, TrendingUp, TrendingDown, FileText, Receipt, Users, Package, FileBarChart, Briefcase, DollarSign } from "lucide-react"
import Link from "next/link"
import TransactionModal from "@/components/TransactionModal"
import { Card, CardHeader, CardTitle, CardBody, CardFooter } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"

export default function DashboardPage() {
  const [activeOrg, setActiveOrg] = useState<any>(null)
  const [totalCash, setTotalCash] = useState(0)
  const [totalBank, setTotalBank] = useState(0)
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [monthlyExpense, setMonthlyExpense] = useState(0)
  const [recentTransactions, setRecentTransactions] = useState<any[]>([])
  const [pendingInvoices, setPendingInvoices] = useState(0)
  const [totalSales, setTotalSales] = useState(0)

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const orgRes = await fetch("/api/organization/active")
        const orgData = await orgRes.json()
        if (orgData.success) {
          setActiveOrg(orgData.organization)
          
          // Fetch transactions for calculations
          const txRes = await fetch(`/api/transactions?orgId=${orgData.organization.id}`)
          const txData = await txRes.json()
          if (txData.success) {
            const transactions = txData.transactions || []
            
            // Calculate totals
            const now = new Date()
            const currentMonth = now.getMonth()
            const currentYear = now.getFullYear()
            
            let cash = 0
            let bank = 0
            let income = 0
            let expense = 0
            let sales = 0
            
            transactions.forEach((tx: any) => {
              const txDate = new Date(tx.date)
              const isThisMonth = txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear
              
              tx.lines?.forEach((line: any) => {
                if (line.account?.type === "CASH") {
                  cash += line.debit || 0
                  cash -= line.credit || 0
                } else if (line.account?.type === "BANK") {
                  bank += line.debit || 0
                  bank -= line.credit || 0
                }
                
                if (isThisMonth) {
                  income += line.debit || 0
                  expense += line.credit || 0
                }
                
                // Calculate total sales (debit to revenue accounts)
                if (line.account?.category === "REVENUE") {
                  sales += line.debit || 0
                }
              })
            })
            
            setTotalCash(cash)
            setTotalBank(bank)
            setMonthlyIncome(income)
            setMonthlyExpense(expense)
            setTotalSales(sales)
            setRecentTransactions(transactions.slice(0, 5))
            
            // Calculate pending invoices (placeholder - would need actual invoice data)
            setPendingInvoices(0)
          }
        }
      } catch (error) {
        console.error("Failed to load dashboard data:", error)
      }
    }
    
    loadDashboardData()
  }, [])

  if (!activeOrg) {
    return (
      <div className="p-6 text-center text-slate-500">
        <p>Memuat data...</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Dashboard</h1>
      
      {/* QUICK ACTION BUTTONS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
        <Card>
          <CardHeader>
            <CardTitle>Saldo Kas Kecil</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-3xl font-black text-slate-800">
              {totalCash === 0 ? 'Rp 0' : `Rp ${totalCash.toLocaleString('id-ID')}`}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Saldo Bank</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-3xl font-black text-slate-800">
              {totalBank === 0 ? 'Rp 0' : `Rp ${totalBank.toLocaleString('id-ID')}`}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pemasukan (Bulan Ini)</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-3xl font-black text-slate-800">
              {monthlyIncome === 0 ? 'Rp 0' : `Rp ${monthlyIncome.toLocaleString('id-ID')}`}
            </p>
            <p className="text-sm font-medium text-emerald-600 mt-2">
              {monthlyIncome > 0 ? '↑ Dari transaksi bulan ini' : 'Belum ada pemasukan'}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pengeluaran (Bulan Ini)</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-3xl font-black text-slate-800">
              {monthlyExpense === 0 ? 'Rp 0' : `Rp ${monthlyExpense.toLocaleString('id-ID')}`}
            </p>
            <p className="text-sm font-medium text-rose-600 mt-2">
              {monthlyExpense > 0 ? '↓ Dari transaksi bulan ini' : 'Belum ada pengeluaran'}
            </p>
          </CardBody>
        </Card>
      </div>

      {/* ADDITIONAL METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Total Penjualan</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-3xl font-black text-slate-800">
              {totalSales === 0 ? 'Rp 0' : `Rp ${totalSales.toLocaleString('id-ID')}`}
            </p>
            <p className="text-sm font-medium text-emerald-600 mt-2">Total revenue</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoice Jatuh Tempo</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-3xl font-black text-slate-800">{pendingInvoices}</p>
            <p className="text-sm text-slate-500 mt-2">Segera lakukan penagihan kepada pelanggan.</p>
          </CardBody>
          <CardFooter>
            <Button variant="outline" size="sm" className="w-full">
              Lihat Daftar Invoice
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Laporan Keuangan</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="flex gap-2">
              <Link href="/laporan/neraca" className="flex-1">
                <Button variant="outline" size="sm" className="w-full">
                  <FileBarChart size={16} className="mr-2" /> Neraca
                </Button>
              </Link>
              <Link href="/laporan/laba-rugi" className="flex-1">
                <Button variant="outline" size="sm" className="w-full">
                  <TrendingUp size={16} className="mr-2" /> Laba Rugi
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* AREA TRANSAKSI TERAKHIR */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Transaksi Terakhir</CardTitle>
            {recentTransactions.length > 0 && (
              <Link href="/transaksi" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                Lihat Semua
              </Link>
            )}
          </div>
        </CardHeader>
        <CardBody>
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
                          Rp {tx.lines.reduce((sum: number, l: any) => sum + (l.debit || l.credit), 0).toLocaleString('id-ID')}
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
        </CardBody>
      </Card>
    </div>
  )
}