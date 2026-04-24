"use client"

import { useEffect, useState } from "react"

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount || 0)
}

type Segment = {
  id: string
  name: string
  type: "product" | "geographic" | "business"
  revenue: number
  profit: number
  assets: number
  liabilities: number
}

type SegmentData = {
  byProduct: Segment[]
  byGeographic: Segment[]
  byBusiness: Segment[]
  totalRevenue: number
  totalProfit: number
  intersegmentRevenue: number
}

export default function SegmentReporting(props: { initialStartDate?: string; initialEndDate?: string }) {
  const [startDate, setStartDate] = useState(props.initialStartDate || new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0])
  const [endDate, setEndDate] = useState(props.initialEndDate || new Date().toISOString().split("T")[0])
  const [data, setData] = useState<SegmentData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      setData(null)
    } catch (e) {
      setData(null)
      setError(e instanceof Error ? e.message : "Gagal memuat laporan")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate])

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Mulai</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Akhir</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <button onClick={load} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">
          Tampilkan
        </button>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {loading ? (
        <div className="py-12 text-center text-slate-500">Loading...</div>
      ) : data ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-sm text-slate-600">Total Pendapatan</div>
              <div className="text-xl font-bold text-slate-900">{formatCurrency(data.totalRevenue)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-sm text-slate-600">Total Laba</div>
              <div className="text-xl font-bold text-slate-900">{formatCurrency(data.totalProfit)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-sm text-slate-600">Pendapatan Intersegment</div>
              <div className="text-xl font-bold text-slate-900">{formatCurrency(data.intersegmentRevenue)}</div>
            </div>
          </div>

          {/* PSAK 7 Information */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <strong>PSAK 7 Segment Reporting:</strong> Laporan ini mengikuti standar PSAK 7 untuk pengungkapan informasi segment berdasarkan produk, wilayah geografis, dan jenis usaha.
          </div>

          {/* By Product */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-900">Segment Berdasarkan Produk</h3>
            </div>
            <table className="min-w-[800px] w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-700">
                  <th className="px-4 py-3 font-bold">Produk</th>
                  <th className="px-4 py-3 font-bold text-right">Pendapatan</th>
                  <th className="px-4 py-3 font-bold text-right">Laba</th>
                  <th className="px-4 py-3 font-bold text-right">Aset</th>
                  <th className="px-4 py-3 font-bold text-right">Liabilitas</th>
                </tr>
              </thead>
              <tbody>
                {data.byProduct.map((seg) => (
                  <tr key={seg.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-800">{seg.name}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(seg.revenue)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(seg.profit)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(seg.assets)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(seg.liabilities)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* By Geographic */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-900">Segment Berdasarkan Wilayah Geografis</h3>
            </div>
            <table className="min-w-[800px] w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-700">
                  <th className="px-4 py-3 font-bold">Wilayah</th>
                  <th className="px-4 py-3 font-bold text-right">Pendapatan</th>
                  <th className="px-4 py-3 font-bold text-right">Laba</th>
                  <th className="px-4 py-3 font-bold text-right">Aset</th>
                  <th className="px-4 py-3 font-bold text-right">Liabilitas</th>
                </tr>
              </thead>
              <tbody>
                {data.byGeographic.map((seg) => (
                  <tr key={seg.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-800">{seg.name}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(seg.revenue)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(seg.profit)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(seg.assets)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(seg.liabilities)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* By Business */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-900">Segment Berdasarkan Jenis Usaha</h3>
            </div>
            <table className="min-w-[800px] w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-700">
                  <th className="px-4 py-3 font-bold">Jenis Usaha</th>
                  <th className="px-4 py-3 font-bold text-right">Pendapatan</th>
                  <th className="px-4 py-3 font-bold text-right">Laba</th>
                  <th className="px-4 py-3 font-bold text-right">Aset</th>
                  <th className="px-4 py-3 font-bold text-right">Liabilitas</th>
                </tr>
              </thead>
              <tbody>
                {data.byBusiness.map((seg) => (
                  <tr key={seg.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-800">{seg.name}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(seg.revenue)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(seg.profit)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(seg.assets)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(seg.liabilities)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="text-sm text-amber-900">Tidak ada data segment untuk periode ini.</p>
        </div>
      )}
    </div>
  )
}
