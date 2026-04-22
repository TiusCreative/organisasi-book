"use client"

import { useState, useEffect, useRef } from "react"
import { Printer, Download, Share2, FileText, ShoppingBag } from "lucide-react"
import { formatDateRange, formatInputDate, resolveDateRange } from "@/lib/date-range"

export default function POReportPage({ searchParams }: { searchParams?: Promise<{ startDate?: string; endDate?: string }> }) {
  const [pos, setPos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const init = async () => {
      const params = searchParams ? await searchParams : {}
      const { startDate: sd, endDate: ed } = resolveDateRange(params)
      setStartDate(formatInputDate(sd))
      setEndDate(formatInputDate(ed))
      loadData(sd, ed)
    }
    init()
  }, [searchParams])

  const loadData = async (start: Date, end: Date) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/po?startDate=${formatInputDate(start)}&endDate=${formatInputDate(end)}`)
      const data = await res.json()
      if (data.success) setPos(data.purchaseOrders)
    } catch (error) {
      console.error("Error loading PO data:", error)
    }
    setLoading(false)
  }

  const handleFilter = () => {
    const url = new URL(window.location.href)
    url.searchParams.set("startDate", startDate)
    url.searchParams.set("endDate", endDate)
    window.location.href = url.toString()
  }

  const handlePrint = () => {
    window.print()
  }

  const handleShareWhatsApp = () => {
    const totalAmount = pos.reduce((sum, po) => sum + parseFloat(po.totalAmount), 0)
    const message = `*LAPORAN PURCHASE ORDER*\n\nPeriode: ${formatDateRange(new Date(startDate), new Date(endDate))}\n\nTotal PO: ${pos.length}\nTotal Amount: Rp ${totalAmount.toLocaleString("id-ID")}\n\nDetail:\n${pos.map(po => `- ${po.poNumber}: ${po.supplier?.name} - Rp ${parseFloat(po.totalAmount).toLocaleString("id-ID")}`).join("\n")}`
    
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank")
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <div className="max-w-full lg:max-w-7xl mx-auto px-4 sm:px-0 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">Laporan Purchase Order</h1>
          <p className="text-slate-500 text-sm mt-1">Purchase Order dengan status dan supplier</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleShareWhatsApp}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700"
          >
            <Share2 size={16} />
            WhatsApp
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
          >
            <Printer size={16} />
            Cetak
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="form-field rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="form-field rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <button
          onClick={handleFilter}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
        >
          Filter
        </button>
      </div>

      <div ref={printRef} className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center gap-3">
              <ShoppingBag className="text-blue-600" size={24} />
              <div>
                <p className="text-sm text-blue-700">Total PO</p>
                <p className="text-2xl font-bold text-blue-900">{pos.length}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <FileText className="text-slate-600" size={24} />
              <div>
                <p className="text-sm text-slate-700">Draft</p>
                <p className="text-2xl font-bold text-slate-900">{pos.filter(po => po.status === "DRAFT").length}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-3">
              <FileText className="text-emerald-600" size={24} />
              <div>
                <p className="text-sm text-emerald-700">Sent</p>
                <p className="text-2xl font-bold text-emerald-900">{pos.filter(po => po.status === "SENT").length}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
            <div className="flex items-center gap-3">
              <ShoppingBag className="text-indigo-600" size={24} />
              <div>
                <p className="text-sm text-indigo-700">Total Amount</p>
                <p className="text-2xl font-bold text-indigo-900">
                  {formatCurrency(pos.reduce((sum, po) => sum + parseFloat(po.totalAmount), 0))}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* PO Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h2 className="text-lg font-bold text-slate-800">Daftar Purchase Order</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading...</div>
          ) : pos.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Tidak ada purchase order</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-4 text-sm font-bold text-slate-700">Nomor PO</th>
                    <th className="text-left p-4 text-sm font-bold text-slate-700">Supplier</th>
                    <th className="text-left p-4 text-sm font-bold text-slate-700">Tanggal Order</th>
                    <th className="text-left p-4 text-sm font-bold text-slate-700">Expected Date</th>
                    <th className="text-right p-4 text-sm font-bold text-slate-700">Subtotal</th>
                    <th className="text-right p-4 text-sm font-bold text-slate-700">Tax</th>
                    <th className="text-right p-4 text-sm font-bold text-slate-700">Total</th>
                    <th className="text-center p-4 text-sm font-bold text-slate-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pos.map((po) => (
                    <tr key={po.id} className="border-b border-slate-100">
                      <td className="p-4 text-sm font-medium">{po.poNumber}</td>
                      <td className="p-4 text-sm">{po.supplier?.name}</td>
                      <td className="p-4 text-sm">{new Date(po.orderDate).toLocaleDateString("id-ID")}</td>
                      <td className="p-4 text-sm">{po.expectedDate ? new Date(po.expectedDate).toLocaleDateString("id-ID") : "-"}</td>
                      <td className="p-4 text-sm text-right">{formatCurrency(parseFloat(po.subtotal))}</td>
                      <td className="p-4 text-sm text-right">{formatCurrency(parseFloat(po.taxAmount))}</td>
                      <td className="p-4 text-sm text-right font-bold">{formatCurrency(parseFloat(po.totalAmount))}</td>
                      <td className="p-4 text-center">
                        <span className={`rounded-full px-2 py-1 text-xs font-bold ${
                          po.status === "DRAFT" ? "bg-slate-100 text-slate-800" :
                          po.status === "SENT" ? "bg-blue-100 text-blue-800" :
                          po.status === "RECEIVED" ? "bg-green-100 text-green-800" :
                          "bg-red-100 text-red-800"
                        }`}>
                          {po.status}
                        </span>
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
