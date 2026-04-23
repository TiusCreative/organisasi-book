"use client"

import { useEffect, useState } from "react"
import { getReservesAndDistributionsReport } from "@/app/actions/retained-earnings"

type Result = Awaited<ReturnType<typeof getReservesAndDistributionsReport>>

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount || 0)
}

export default function ReservesAndDistributionsReport(props: { initialStartDate?: string; initialEndDate?: string }) {
  const [startDate, setStartDate] = useState(props.initialStartDate || new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0])
  const [endDate, setEndDate] = useState(props.initialEndDate || new Date().toISOString().split("T")[0])
  const [data, setData] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const result = await getReservesAndDistributionsReport({ startDate, endDate })
      setData(result)
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
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-sm text-slate-600">Total Saldo Awal</div>
              <div className="text-xl font-bold text-slate-900">{formatCurrency(data.totals.opening)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-sm text-slate-600">Total Perubahan</div>
              <div className="text-xl font-bold text-slate-900">{formatCurrency(data.totals.netChange)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-sm text-slate-600">Total Saldo Akhir</div>
              <div className="text-xl font-bold text-slate-900">{formatCurrency(data.totals.closing)}</div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-[860px] w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-700">
                  <th className="px-4 py-3 font-bold">Akun</th>
                  <th className="px-4 py-3 font-bold">Kategori</th>
                  <th className="px-4 py-3 font-bold text-right">Saldo Awal</th>
                  <th className="px-4 py-3 font-bold text-right">Perubahan</th>
                  <th className="px-4 py-3 font-bold text-right">Saldo Akhir</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 ? (
                  <tr className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-600" colSpan={5}>Tidak ada akun cadangan/distribusi selain Modal dan Laba Ditahan.</td>
                  </tr>
                ) : (
                  data.rows.map((row) => (
                    <tr key={row.accountId} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-slate-800">{row.code} {row.name}</td>
                      <td className="px-4 py-3 text-slate-600">{row.category || "-"}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatCurrency(row.opening)}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatCurrency(row.netChange)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold">{formatCurrency(row.closing)}</td>
                    </tr>
                  ))
                )}
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                  <td className="px-4 py-3" colSpan={2}>Total</td>
                  <td className="px-4 py-3 text-right font-mono">{formatCurrency(data.totals.opening)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatCurrency(data.totals.netChange)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatCurrency(data.totals.closing)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}

