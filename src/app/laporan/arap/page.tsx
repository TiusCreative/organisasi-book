"use client"

import { useState, useEffect, useRef } from "react"
import { Printer, Download, Share2, FileText, DollarSign } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { formatDateRange, formatInputDate, resolveDateRange } from "@/lib/date-range"

export default function ARAPReportPage({ searchParams }: { searchParams?: Promise<{ startDate?: string; endDate?: string }> }) {
  const [invoices, setInvoices] = useState<any[]>([])
  const [vendorBills, setVendorBills] = useState<any[]>([])
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
      const [invRes, vbRes] = await Promise.all([
        fetch(`/api/arap/invoices?startDate=${formatInputDate(start)}&endDate=${formatInputDate(end)}`),
        fetch(`/api/arap/vendor-bills?startDate=${formatInputDate(start)}&endDate=${formatInputDate(end)}`)
      ])
      const [invData, vbData] = await Promise.all([invRes.json(), vbRes.json()])
      if (invData.success) setInvoices(invData.invoices)
      if (vbData.success) setVendorBills(vbData.vendorBills)
    } catch (error) {
      console.error("Error loading AR/AP data:", error)
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
    const totalAR = invoices.reduce((sum, inv) => sum + inv.remainingAmount, 0)
    const totalAP = vendorBills.reduce((sum, vb) => sum + vb.remainingAmount, 0)
    const message = `*LAPORAN AR/AP*\n\nPeriode: ${formatDateRange(new Date(startDate), new Date(endDate))}\n\nAccount Receivable: ${invoices.length} Invoice\nTotal AR: Rp ${totalAR.toLocaleString("id-ID")}\n\nAccount Payable: ${vendorBills.length} Vendor Bill\nTotal AP: Rp ${totalAP.toLocaleString("id-ID")}\n\nNet Position: Rp ${(totalAR - totalAP).toLocaleString("id-ID")}`
    
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
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">Laporan AR/AP</h1>
          <p className="text-slate-500 text-sm mt-1">Account Receivable dan Account Payable</p>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="text-emerald-600" size={24} />
              <div>
                <p className="text-sm text-emerald-700">Total Account Receivable</p>
                <p className="text-xl font-bold text-emerald-900">
                  {formatCurrency(invoices.reduce((sum, inv) => sum + inv.remainingAmount, 0))}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
            <div className="flex items-center gap-3">
              <FileText className="text-orange-600" size={24} />
              <div>
                <p className="text-sm text-orange-700">Total Account Payable</p>
                <p className="text-xl font-bold text-orange-900">
                  {formatCurrency(vendorBills.reduce((sum, vb) => sum + vb.remainingAmount, 0))}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center gap-3">
              <FileText className="text-blue-600" size={24} />
              <div>
                <p className="text-sm text-blue-700">Net Position (AR - AP)</p>
                <p className="text-xl font-bold text-blue-900">
                  {formatCurrency(
                    invoices.reduce((sum, inv) => sum + inv.remainingAmount, 0) -
                    vendorBills.reduce((sum, vb) => sum + vb.remainingAmount, 0)
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Invoice Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h2 className="text-lg font-bold text-slate-800">Account Receivable (Invoices)</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading...</div>
          ) : invoices.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Tidak ada invoice</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-4 text-sm font-bold text-slate-700">Nomor</th>
                    <th className="text-left p-4 text-sm font-bold text-slate-700">Customer</th>
                    <th className="text-left p-4 text-sm font-bold text-slate-700">Tanggal</th>
                    <th className="text-right p-4 text-sm font-bold text-slate-700">Total</th>
                    <th className="text-right p-4 text-sm font-bold text-slate-700">Paid</th>
                    <th className="text-right p-4 text-sm font-bold text-slate-700">Remaining</th>
                    <th className="text-center p-4 text-sm font-bold text-slate-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-slate-100">
                      <td className="p-4 text-sm">{inv.invoiceNumber}</td>
                      <td className="p-4 text-sm">{inv.customer?.name}</td>
                      <td className="p-4 text-sm">{new Date(inv.invoiceDate).toLocaleDateString("id-ID")}</td>
                      <td className="p-4 text-sm text-right">{formatCurrency(inv.totalAmount)}</td>
                      <td className="p-4 text-sm text-right">{formatCurrency(inv.paidAmount)}</td>
                      <td className="p-4 text-sm text-right font-bold">{formatCurrency(inv.remainingAmount)}</td>
                      <td className="p-4 text-center">
                        <span className={`rounded-full px-2 py-1 text-xs font-bold ${
                          inv.status === "PAID" ? "bg-green-100 text-green-800" :
                          inv.status === "PARTIALLY_PAID" ? "bg-yellow-100 text-yellow-800" :
                          inv.status === "OVERDUE" ? "bg-red-100 text-red-800" :
                          "bg-slate-100 text-slate-800"
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Vendor Bill Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h2 className="text-lg font-bold text-slate-800">Account Payable (Vendor Bills)</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading...</div>
          ) : vendorBills.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Tidak ada vendor bill</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-4 text-sm font-bold text-slate-700">Nomor</th>
                    <th className="text-left p-4 text-sm font-bold text-slate-700">Supplier</th>
                    <th className="text-left p-4 text-sm font-bold text-slate-700">Tanggal</th>
                    <th className="text-right p-4 text-sm font-bold text-slate-700">Total</th>
                    <th className="text-right p-4 text-sm font-bold text-slate-700">Paid</th>
                    <th className="text-right p-4 text-sm font-bold text-slate-700">Remaining</th>
                    <th className="text-center p-4 text-sm font-bold text-slate-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorBills.map((vb) => (
                    <tr key={vb.id} className="border-b border-slate-100">
                      <td className="p-4 text-sm">{vb.billNumber}</td>
                      <td className="p-4 text-sm">{vb.supplier?.name}</td>
                      <td className="p-4 text-sm">{new Date(vb.billDate).toLocaleDateString("id-ID")}</td>
                      <td className="p-4 text-sm text-right">{formatCurrency(vb.totalAmount)}</td>
                      <td className="p-4 text-sm text-right">{formatCurrency(vb.paidAmount)}</td>
                      <td className="p-4 text-sm text-right font-bold">{formatCurrency(vb.remainingAmount)}</td>
                      <td className="p-4 text-center">
                        <span className={`rounded-full px-2 py-1 text-xs font-bold ${
                          vb.status === "PAID" ? "bg-green-100 text-green-800" :
                          vb.status === "PARTIALLY_PAID" ? "bg-yellow-100 text-yellow-800" :
                          vb.status === "OVERDUE" ? "bg-red-100 text-red-800" :
                          "bg-slate-100 text-slate-800"
                        }`}>
                          {vb.status}
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
