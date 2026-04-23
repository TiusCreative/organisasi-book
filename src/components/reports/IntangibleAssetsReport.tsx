"use client"

import { useEffect, useState } from "react"
import { getIntangibleAssetsReport } from "@/app/actions/intangible-assets"

type Result = Awaited<ReturnType<typeof getIntangibleAssetsReport>>

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount || 0)
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("id-ID")
}

export default function IntangibleAssetsReport() {
  const [data, setData] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    const result = await getIntangibleAssetsReport()
    setData(result)
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {loading ? (
        <div className="py-12 text-center text-slate-500">Loading...</div>
      ) : data ? (
        <div className="space-y-4">
          {"error" in data && data.error ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{data.error}</div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-sm text-slate-600">Total Harga Perolehan</div>
              <div className="text-xl font-bold text-slate-900">{formatCurrency(data.totals.purchasePrice)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-sm text-slate-600">Total Akumulasi Amortisasi</div>
              <div className="text-xl font-bold text-slate-900">{formatCurrency(data.totals.accumulatedAmortization)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-sm text-slate-600">Total Nilai Buku</div>
              <div className="text-xl font-bold text-slate-900">{formatCurrency(data.totals.bookValue)}</div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-[980px] w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-700">
                  <th className="px-4 py-3 font-bold">Kode</th>
                  <th className="px-4 py-3 font-bold">Nama</th>
                  <th className="px-4 py-3 font-bold">Tanggal</th>
                  <th className="px-4 py-3 font-bold text-right">Harga</th>
                  <th className="px-4 py-3 font-bold text-right">Akum. Amortisasi</th>
                  <th className="px-4 py-3 font-bold text-right">Nilai Buku</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 ? (
                  <tr className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-600" colSpan={7}>Belum ada data Aset Tak Berwujud.</td>
                  </tr>
                ) : (
                  data.rows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-mono text-slate-800">{row.code}</td>
                      <td className="px-4 py-3 text-slate-800">{row.name}</td>
                      <td className="px-4 py-3 text-slate-700">{formatDate(row.purchaseDate)}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatCurrency(row.purchasePrice)}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatCurrency(row.accumulatedAmortization)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold">{formatCurrency(row.bookValue)}</td>
                      <td className="px-4 py-3 text-slate-700">{row.status}</td>
                    </tr>
                  ))
                )}
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                  <td className="px-4 py-3" colSpan={3}>Total</td>
                  <td className="px-4 py-3 text-right font-mono">{formatCurrency(data.totals.purchasePrice)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatCurrency(data.totals.accumulatedAmortization)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatCurrency(data.totals.bookValue)}</td>
                  <td className="px-4 py-3" />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}

