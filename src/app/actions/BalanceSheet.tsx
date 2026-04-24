"use client"

import { useState, useEffect } from "react"
import { getBalanceSheetData } from "@/app/actions/accounting"
import { RefreshCw, Scale } from "lucide-react"

type AccountBalance = {
  id: string
  code: string
  name: string
  balance: number
  isHeader: boolean
}

export default function BalanceSheet() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().split("T")[0])

  const loadData = async () => {
    setLoading(true)
    const res = await getBalanceSheetData(asOfDate)
    if (res.success) {
      setData(res.data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [asOfDate])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(amount)
  }

  const renderAccountGroup = (title: string, accounts: AccountBalance[], total: number, additionalRow?: React.ReactNode) => (
    <div className="mb-6">
      <h3 className="font-bold text-lg border-b-2 border-slate-800 pb-2 mb-3 text-slate-800">{title}</h3>
      <div className="space-y-1">
        {accounts.map(acc => (
          <div key={acc.id} className={`flex justify-between py-1 px-2 rounded hover:bg-slate-50 ${acc.isHeader ? 'font-bold mt-2 bg-slate-100' : 'text-sm ml-4'}`}>
            <span>{acc.code} - {acc.name}</span>
            <span>{acc.isHeader ? "" : formatCurrency(acc.balance)}</span>
          </div>
        ))}
        {accounts.length === 0 && <div className="text-sm text-slate-400 italic py-2">Tidak ada data akun.</div>}
        
        {additionalRow}
        
        <div className="flex justify-between font-bold text-slate-800 mt-4 pt-2 border-t border-slate-300">
          <span>Total {title}</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  )

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Scale className="text-blue-600" /> Neraca Keuangan (Balance Sheet)
          </h2>
          <p className="text-sm text-slate-500">Laporan posisi keuangan perusahaan pada tanggal tertentu.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-700">Per Tanggal:</span>
          <input 
            type="date" 
            value={asOfDate} 
            onChange={(e) => setAsOfDate(e.target.value)} 
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" 
          />
          <button 
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500">Mengkalkulasi posisi buku besar...</div>
      ) : !data ? (
        <div className="text-center text-red-500 py-8">Gagal memuat data neraca.</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 bg-slate-50 border-b border-slate-200 text-center">
            <h1 className="text-xl font-bold text-slate-800 uppercase tracking-wider">Neraca Keuangan</h1>
            <p className="text-slate-600 font-medium">Per {new Date(asOfDate).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric'})}</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 p-6 lg:p-8">
            {/* Sisi Kiri: Aset */}
            <div>
              {renderAccountGroup("Aset (Harta)", data.assets, data.totalAssets)}
            </div>
            
            {/* Sisi Kanan: Kewajiban & Ekuitas */}
            <div>
              {renderAccountGroup("Kewajiban (Hutang)", data.liabilities, data.totalLiabilities)}
              
              {renderAccountGroup(
                "Ekuitas (Modal)", 
                data.equities, 
                data.totalEquity,
                <div className="flex justify-between py-1 px-2 text-sm ml-4 text-emerald-700 font-medium bg-emerald-50 rounded">
                  <span>Laba / (Rugi) Berjalan</span>
                  <span>{formatCurrency(data.netIncome)}</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Footer Neraca Seimbang */}
          <div className="bg-slate-800 text-white p-6 grid md:grid-cols-2 gap-8 rounded-b-xl">
            <div className="flex justify-between items-center text-lg font-bold">
              <span>TOTAL ASET</span>
              <span>{formatCurrency(data.totalAssets)}</span>
            </div>
            <div className="flex justify-between items-center text-lg font-bold">
              <span>TOTAL KEWAJIBAN & EKUITAS</span>
              <span className={Math.abs(data.totalAssets - (data.totalLiabilities + data.totalEquity)) > 0.01 ? "text-red-400" : "text-emerald-400"}>
                {formatCurrency(data.totalLiabilities + data.totalEquity)}
              </span>
            </div>
          </div>
          
          {/* Indikator Balance */}
          {Math.abs(data.totalAssets - (data.totalLiabilities + data.totalEquity)) > 0.01 && (
            <div className="bg-red-50 text-red-600 p-4 text-center text-sm font-medium border-t border-red-200">
              Peringatan: Terdapat selisih (Unbalanced) sebesar {formatCurrency(Math.abs(data.totalAssets - (data.totalLiabilities + data.totalEquity)))}. Periksa kembali integritas jurnal manual Anda.
            </div>
          )}
        </div>
      )}
    </div>
  )
}