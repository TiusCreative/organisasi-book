"use client"

import { useState, useEffect } from "react"
import { getFinancialDashboardData } from "@/app/actions/dashboard"
import { TrendingUp, TrendingDown, WalletCards, Receipt, AlertCircle } from "lucide-react"

export default function FinancialDashboard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      const res = await getFinancialDashboardData()
      if (res.success) {
        setData(res)
      }
      setLoading(false)
    }
    loadData()
  }, [])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount)
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-500 animate-pulse">Memuat data Dashboard Keuangan...</div>
  }

  if (!data) return null

  // Kalkulasi YTD (Year to Date) Laba Rugi
  const ytdRevenue = data.monthlyData.reduce((acc: number, curr: any) => acc + curr.revenue, 0)
  const ytdExpense = data.monthlyData.reduce((acc: number, curr: any) => acc + curr.expense, 0)
  const ytdProfit = ytdRevenue - ytdExpense

  // Logic untuk proporsi tinggi grafik batang (Bar Chart)
  const maxChartValue = Math.max(...data.monthlyData.flatMap((d: any) => [d.revenue, d.expense]), 1)

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Dashboard Keuangan</h2>
        <p className="text-sm text-slate-500">Ringkasan performa keuangan dan tagihan organisasi tahun {new Date().getFullYear()}.</p>
      </div>

      {/* Cards Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <span className="text-sm font-semibold text-slate-500 mb-1 flex items-center gap-2"><Receipt size={16} className="text-blue-500" /> Piutang Belum Dibayar</span>
          <span className="text-2xl font-bold text-slate-800">{formatCurrency(data.unpaidInvoices)}</span>
          <span className="text-xs text-slate-400 mt-2">Uang yang akan masuk dari pelanggan</span>
        </div>
        
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <span className="text-sm font-semibold text-slate-500 mb-1 flex items-center gap-2"><WalletCards size={16} className="text-rose-500" /> Hutang Belum Dibayar</span>
          <span className="text-2xl font-bold text-slate-800">{formatCurrency(data.unpaidBills)}</span>
          <span className="text-xs text-slate-400 mt-2">Kewajiban tagihan kepada vendor/supplier</span>
        </div>
        
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <span className="text-sm font-semibold text-slate-500 mb-1 flex items-center gap-2"><TrendingUp size={16} className="text-emerald-500" /> Pendapatan (YTD)</span>
          <span className="text-2xl font-bold text-slate-800">{formatCurrency(ytdRevenue)}</span>
          <span className="text-xs text-slate-400 mt-2">Total pendapatan masuk tahun ini</span>
        </div>
        
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <span className="text-sm font-semibold text-slate-500 mb-1 flex items-center gap-2"><TrendingDown size={16} className="text-amber-500" /> Kas Keluar & Beban (YTD)</span>
          <span className="text-2xl font-bold text-slate-800">{formatCurrency(ytdExpense)}</span>
          <span className="text-xs text-slate-400 mt-2">Total pengeluaran operasional tahun ini</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Grafik Batang (Bar Chart) Laba/Rugi */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-800">Grafik Pemasukan vs Pengeluaran</h3>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-500 rounded-sm"></div> Pendapatan</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-rose-500 rounded-sm"></div> Pengeluaran</div>
            </div>
          </div>
          
          <div className="h-64 flex items-end gap-2 sm:gap-4 border-b border-slate-200 pb-2 relative">
            {/* Grid Lines Overlay */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
              <div className="border-t border-slate-400 w-full h-0"></div>
              <div className="border-t border-slate-400 w-full h-0"></div>
              <div className="border-t border-slate-400 w-full h-0"></div>
              <div className="border-t border-slate-400 w-full h-0"></div>
            </div>

            {/* Bars */}
            {data.monthlyData.map((monthData: any, idx: number) => (
              <div key={idx} className="flex-1 flex justify-center items-end gap-1 h-full relative group">
                <div 
                  className="w-1/2 bg-emerald-500 hover:bg-emerald-400 rounded-t-sm transition-all duration-300" 
                  style={{ height: `${(monthData.revenue / maxChartValue) * 100}%`, minHeight: monthData.revenue > 0 ? '4px' : '0' }}
                  title={`${monthData.month}: Pemasukan ${formatCurrency(monthData.revenue)}`}
                ></div>
                <div 
                  className="w-1/2 bg-rose-500 hover:bg-rose-400 rounded-t-sm transition-all duration-300" 
                  style={{ height: `${(monthData.expense / maxChartValue) * 100}%`, minHeight: monthData.expense > 0 ? '4px' : '0' }}
                  title={`${monthData.month}: Pengeluaran ${formatCurrency(monthData.expense)}`}
                ></div>
                <div className="absolute -bottom-6 text-xs font-medium text-slate-500">{monthData.month}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Mini Widget Laba Bersih */}
        <div className={`p-6 rounded-xl border flex flex-col justify-center items-center text-center shadow-sm ${ytdProfit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
          <h3 className="font-bold text-slate-600 mb-2">Laba Bersih Tahun Ini</h3>
          <span className={`text-4xl font-black ${ytdProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatCurrency(ytdProfit)}</span>
          <p className="text-sm mt-4 text-slate-500">{ytdProfit >= 0 ? 'Performa perusahaan positif dan mencetak keuntungan.' : 'Perusahaan mengalami kerugian / defisit kas.'}</p>
        </div>
      </div>
    </div>
  )
}