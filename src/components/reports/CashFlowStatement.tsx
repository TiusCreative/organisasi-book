"use client"

import { useState, useEffect } from "react"
import { getCashFlowStatement } from "../../app/actions/cashflow"

type FlowLine = { label: string; amount: number }
type CashFlowResult = Awaited<ReturnType<typeof getCashFlowStatement>>

export default function CashFlowStatement({
  organizationId,
  initialStartDate,
  initialEndDate,
}: {
  organizationId: string
  initialStartDate?: string
  initialEndDate?: string
}) {
  const [startDate, setStartDate] = useState(
    initialStartDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]
  )
  const [endDate, setEndDate] = useState(
    initialEndDate || new Date().toISOString().split("T")[0]
  )
  const [cashFlow, setCashFlow] = useState<CashFlowResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadCashFlow()
  }, [startDate, endDate])

  const loadCashFlow = async () => {
    setLoading(true)
    const result = await getCashFlowStatement(new Date(startDate), new Date(endDate))
    setCashFlow(result)
    setLoading(false)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const renderTopLines = (title: string, lines: FlowLine[]) => {
    const top = (lines || []).slice(0, 8)
    if (top.length === 0) return null
    return (
      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-bold text-slate-800 mb-2">{title}</div>
        <div className="space-y-1">
          {top.map((row) => (
            <div key={row.label} className="flex justify-between text-xs text-slate-700">
              <span className="truncate pr-4">{row.label}</span>
              <span className="font-mono">{formatCurrency(row.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Date Filter */}
      <div className="flex flex-col sm:flex-row gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Mulai</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Akhir</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={loadCashFlow}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
        >
          Tampilkan
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500">Loading...</div>
      ) : cashFlow ? (
        <div className="space-y-6">
          {/* Operating Activities */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Aktivitas Operasional</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Pemasukan Operasional</span>
                <span className="text-emerald-600 font-medium">+{formatCurrency(cashFlow.operating.in)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Pengeluaran Operasional</span>
                <span className="text-red-600 font-medium">-{formatCurrency(cashFlow.operating.out)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-2 mt-2">
                <span className="text-slate-800">Net Cash Flow Operasional</span>
                <span className={cashFlow.operating.net >= 0 ? "text-emerald-600" : "text-red-600"}>
                  {cashFlow.operating.net >= 0 ? "+" : ""}{formatCurrency(cashFlow.operating.net)}
                </span>
              </div>
            </div>
            {renderTopLines("Top Pemasukan Operasional", cashFlow.operating.linesIn || [])}
            {renderTopLines("Top Pengeluaran Operasional", cashFlow.operating.linesOut || [])}
          </div>

          {/* Investing Activities */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Aktivitas Investasi</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Pemasukan Investasi</span>
                <span className="text-emerald-600 font-medium">+{formatCurrency(cashFlow.investing.in)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Pengeluaran Investasi</span>
                <span className="text-red-600 font-medium">-{formatCurrency(cashFlow.investing.out)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-2 mt-2">
                <span className="text-slate-800">Net Cash Flow Investasi</span>
                <span className={cashFlow.investing.net >= 0 ? "text-emerald-600" : "text-red-600"}>
                  {cashFlow.investing.net >= 0 ? "+" : ""}{formatCurrency(cashFlow.investing.net)}
                </span>
              </div>
            </div>
            {renderTopLines("Top Pemasukan Investasi", cashFlow.investing.linesIn || [])}
            {renderTopLines("Top Pengeluaran Investasi", cashFlow.investing.linesOut || [])}
          </div>

          {/* Financing Activities */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Aktivitas Financing</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Pemasukan Financing</span>
                <span className="text-emerald-600 font-medium">+{formatCurrency(cashFlow.financing.in)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Pengeluaran Financing</span>
                <span className="text-red-600 font-medium">-{formatCurrency(cashFlow.financing.out)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-2 mt-2">
                <span className="text-slate-800">Net Cash Flow Financing</span>
                <span className={cashFlow.financing.net >= 0 ? "text-emerald-600" : "text-red-600"}>
                  {cashFlow.financing.net >= 0 ? "+" : ""}{formatCurrency(cashFlow.financing.net)}
                </span>
              </div>
            </div>
            {renderTopLines("Top Pemasukan Financing", cashFlow.financing.linesIn || [])}
            {renderTopLines("Top Pengeluaran Financing", cashFlow.financing.linesOut || [])}
          </div>

          {/* Summary */}
          <div className="rounded-xl border-2 border-slate-300 bg-slate-50 p-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Saldo Awal Kas</span>
                <span className="text-slate-800 font-medium">{formatCurrency(cashFlow.beginningBalance)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold">
                <span className="text-slate-800">Net Cash Flow Total</span>
                <span className={cashFlow.netCashFlow >= 0 ? "text-emerald-600" : "text-red-600"}>
                  {cashFlow.netCashFlow >= 0 ? "+" : ""}{formatCurrency(cashFlow.netCashFlow)}
                </span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t-2 border-slate-300 pt-4 mt-4">
                <span className="text-slate-900">Saldo Akhir Kas</span>
                <span className="text-slate-900">{formatCurrency(cashFlow.endingBalance)}</span>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
            <p className="font-bold mb-2">Keterangan:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li><strong>Operasional:</strong> Transaksi rutin operasional (pendapatan & biaya)</li>
              <li><strong>Investasi:</strong> Pembelian/penjualan aset dan investasi</li>
              <li><strong>Financing:</strong> Pinjaman, modal, dan pembagian dividen</li>
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  )
}
