"use client"

import React from "react"
import { useEffect, useState } from "react"

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount || 0)
}

type FinancialStatement = {
  name: string
  items: {
    category: string
    lineItems: {
      name: string
      amount: number
      isSubtotal?: boolean
      isTotal?: boolean
    }[]
  }[]
}

type FinancialPresentationData = {
  balanceSheet: FinancialStatement
  incomeStatement: FinancialStatement
  cashFlowStatement: FinancialStatement
  equityChanges: FinancialStatement
  notes: string[]
}

export default function FinancialPresentation(props: { initialStartDate?: string; initialEndDate?: string }) {
  const [startDate, setStartDate] = useState(props.initialStartDate || new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0])
  const [endDate, setEndDate] = useState(props.initialEndDate || new Date().toISOString().split("T")[0])
  const [data, setData] = useState<FinancialPresentationData | null>(null)
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

  const renderStatement = (statement: FinancialStatement) => (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <h3 className="font-bold text-slate-900">{statement.name}</h3>
      </div>
      <table className="min-w-[600px] w-full text-sm">
        <tbody>
          {statement.items.map((category, catIdx) => (
            <React.Fragment key={catIdx}>
              {category.category && (
                <tr className="border-t border-slate-200 bg-slate-100">
                  <td className="px-4 py-2 font-bold text-slate-900" colSpan={2}>{category.category}</td>
                </tr>
              )}
              {category.lineItems.map((item, itemIdx) => (
                <tr 
                  key={itemIdx} 
                  className={`border-t border-slate-100 ${
                    item.isSubtotal ? "bg-slate-50 font-semibold" : ""
                  } ${
                    item.isTotal ? "border-t-2 border-slate-300 bg-slate-100 font-bold" : ""
                  }`}
                >
                  <td className={`px-4 py-2 ${item.isTotal ? "text-slate-900" : "text-slate-700"}`}>
                    {item.name}
                  </td>
                  <td className={`px-4 py-2 text-right font-mono ${
                    item.isTotal ? "text-slate-900" : "text-slate-600"
                  }`}>
                    {formatCurrency(item.amount)}
                  </td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )

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
          {/* PSAK 1 Information */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <strong>PSAK 1 Penyajian Laporan Keuangan:</strong> Laporan ini mengikuti standar PSAK 1 untuk struktur dan penyajian laporan keuangan lengkap sesuai Standar Akuntansi Keuangan Indonesia (SAK).
          </div>

          {/* Balance Sheet */}
          {renderStatement(data.balanceSheet)}

          {/* Income Statement */}
          {renderStatement(data.incomeStatement)}

          {/* Cash Flow Statement */}
          {renderStatement(data.cashFlowStatement)}

          {/* Equity Changes */}
          {renderStatement(data.equityChanges)}

          {/* Notes */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="font-bold text-slate-900 mb-3">Catatan Laporan Keuangan</h3>
            <ul className="list-disc list-inside space-y-2 text-sm text-slate-700">
              {data.notes.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="text-sm text-amber-900">Tidak ada data presentasi laporan keuangan untuk periode ini.</p>
        </div>
      )}
    </div>
  )
}
