"use client"

import { useMemo, useState, useTransition } from "react"
import {
  createDeliveryOrderFromSalesOrder,
  createInvoiceFromSalesOrder,
  createSalesOrder,
  deleteSalesOrder,
  getSalesModuleData,
  getSalesReportSummary,
  updateSalesCommissionStatus,
  updateSalesOrderStatus,
} from "@/app/actions/sales"
import { FileDown, Printer, Send, Trash2, Truck, ReceiptText, Target, BarChart3, Plus, RefreshCw } from "lucide-react"

type InitialData = Awaited<ReturnType<typeof getSalesModuleData>>
type InitialReport = Awaited<ReturnType<typeof getSalesReportSummary>>

type ItemForm = {
  itemId: string
  quantity: number
  unitPrice: number
  discountPercent: number
  taxPercent: number
  notes: string
}

const defaultItemForm: ItemForm = {
  itemId: "",
  quantity: 1,
  unitPrice: 0,
  discountPercent: 0,
  taxPercent: 11,
  notes: "",
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0)
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "-"
  return new Date(value).toLocaleDateString("id-ID")
}

export default function SalesMarketingManager({ initialData, initialReport }: { initialData: InitialData; initialReport: InitialReport }) {
  const [activeTab, setActiveTab] = useState<"sales" | "delivery" | "invoice" | "commission" | "report">("sales")
  const [data, setData] = useState(initialData)
  const [report, setReport] = useState(initialReport)
  const [message, setMessage] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [isPending, startTransition] = useTransition()

  const [showCreate, setShowCreate] = useState(false)
  const [customerId, setCustomerId] = useState("")
  const [salesPersonId, setSalesPersonId] = useState("")
  const [deliveryDate, setDeliveryDate] = useState("")
  const [notes, setNotes] = useState("")
  const [commissionRate, setCommissionRate] = useState(5)
  const [items, setItems] = useState<ItemForm[]>([{ ...defaultItemForm }])

  const [reportStart, setReportStart] = useState(new Date(report.start).toISOString().slice(0, 10))
  const [reportEnd, setReportEnd] = useState(new Date(report.end).toISOString().slice(0, 10))

  const clearForm = () => {
    setCustomerId("")
    setSalesPersonId("")
    setDeliveryDate("")
    setNotes("")
    setCommissionRate(5)
    setItems([{ ...defaultItemForm }])
  }

  const reloadData = () => {
    startTransition(async () => {
      try {
        setError("")
        const [freshData, freshReport] = await Promise.all([
          getSalesModuleData(),
          getSalesReportSummary(reportStart, reportEnd),
        ])
        setData(freshData)
        setReport(freshReport)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat ulang data sales")
      }
    })
  }

  const calculated = useMemo(() => {
    const computed = items.map((item) => {
      const gross = item.quantity * item.unitPrice
      const discount = gross * (item.discountPercent / 100)
      const taxable = gross - discount
      const tax = taxable * (item.taxPercent / 100)
      const total = taxable + tax
      return { gross, discount, tax, total }
    })

    return {
      subtotal: computed.reduce((sum, row) => sum + row.gross, 0),
      discountAmount: computed.reduce((sum, row) => sum + row.discount, 0),
      taxAmount: computed.reduce((sum, row) => sum + row.tax, 0),
      totalAmount: computed.reduce((sum, row) => sum + row.total, 0),
    }
  }, [items])

  const handleCreateSalesOrder = () => {
    startTransition(async () => {
      try {
        setError("")
        setMessage("")

        await createSalesOrder({
          customerId,
          salesPersonId: salesPersonId || undefined,
          deliveryDate: deliveryDate || undefined,
          notes,
          commissionRate,
          items,
        })

        setShowCreate(false)
        clearForm()
        setMessage("Sales order berhasil dibuat.")
        reloadData()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal membuat sales order")
      }
    })
  }

  const handleCreateDO = (salesOrderId: string) => {
    startTransition(async () => {
      try {
        setError("")
        setMessage("")
        await createDeliveryOrderFromSalesOrder({ salesOrderId })
        setMessage("Delivery order berhasil dibuat dan stok telah diperbarui.")
        reloadData()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal membuat delivery order")
      }
    })
  }

  const handleCreateInvoice = (salesOrderId: string) => {
    startTransition(async () => {
      try {
        setError("")
        setMessage("")
        const result = await createInvoiceFromSalesOrder(salesOrderId)
        setMessage(result.reused ? "Invoice dari sales order sudah ada." : "Invoice otomatis berhasil dibuat dari sales order.")
        reloadData()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal membuat invoice")
      }
    })
  }

  const handleDeleteSalesOrder = (salesOrderId: string) => {
    if (!window.confirm("Hapus sales order ini?")) return

    startTransition(async () => {
      try {
        setError("")
        setMessage("")
        await deleteSalesOrder(salesOrderId)
        setMessage("Sales order berhasil dihapus.")
        reloadData()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal menghapus sales order")
      }
    })
  }

  const handleUpdateSalesStatus = (salesOrderId: string, status: "DRAFT" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED") => {
    startTransition(async () => {
      try {
        await updateSalesOrderStatus({ salesOrderId, status })
        setMessage("Status sales order berhasil diperbarui.")
        reloadData()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal update status")
      }
    })
  }

  const handleUpdateCommissionStatus = (commissionId: string, status: "PENDING" | "APPROVED" | "PAID" | "CANCELLED") => {
    startTransition(async () => {
      try {
        await updateSalesCommissionStatus({ commissionId, status })
        setMessage("Status komisi berhasil diperbarui.")
        reloadData()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal update komisi")
      }
    })
  }

  const handleLoadReport = () => {
    startTransition(async () => {
      try {
        setError("")
        const nextReport = await getSalesReportSummary(reportStart, reportEnd)
        setReport(nextReport)
        setMessage("Laporan sales berhasil dimuat.")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat laporan sales")
      }
    })
  }

  const reportWhatsappText = useMemo(() => {
    const lines = [
      "*LAPORAN SALES/MARKETING*",
      "",
      `Periode: ${formatDate(report.start)} - ${formatDate(report.end)}`,
      `Total Sales Order: ${report.totals.salesOrderCount}`,
      `Nilai Sales Order: ${formatCurrency(report.totals.salesOrderAmount)}`,
      `Total Delivery Order: ${report.totals.deliveryOrderCount}`,
      `Total Invoice: ${report.totals.invoiceCount}`,
      `Nilai Invoice: ${formatCurrency(report.totals.invoiceAmount)}`,
      `Total Komisi: ${formatCurrency(report.totals.commissionAmount)}`,
      "",
      "Top Sales Order:",
      ...report.salesOrders.slice(0, 10).map((so) => `${so.code} | ${so.customer?.name || "-"} | ${formatCurrency(so.totalAmount)} | ${so.status}`),
    ]

    return lines.join("\n")
  }, [report])

  const handleShareReportWhatsapp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(reportWhatsappText)}`, "_blank", "noopener,noreferrer")
  }

  const printReport = () => {
    window.print()
  }

  const downloadReportPdf = () => {
    const printWindow = window.open("", "_blank", "width=1024,height=768")
    if (!printWindow) return

    const html = `
      <html>
        <head>
          <title>Laporan Sales ${formatDate(report.start)} - ${formatDate(report.end)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
            h1 { margin: 0 0 6px 0; }
            p { margin: 0 0 16px 0; color: #334155; }
            table { border-collapse: collapse; width: 100%; margin-top: 14px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; }
            th { background: #e2e8f0; text-align: left; }
          </style>
        </head>
        <body>
          <h1>Laporan Sales / Marketing</h1>
          <p>Periode ${formatDate(report.start)} - ${formatDate(report.end)}</p>
          <table>
            <thead>
              <tr><th>Sales Order</th><th>Customer</th><th>Status</th><th>Total</th></tr>
            </thead>
            <tbody>
              ${report.salesOrders
                .map(
                  (row) =>
                    `<tr><td>${row.code}</td><td>${row.customer?.name || "-"}</td><td>${row.status}</td><td>${formatCurrency(row.totalAmount)}</td></tr>`
                )
                .join("")}
            </tbody>
          </table>
          <script>window.print()</script>
        </body>
      </html>
    `

    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {[
            { key: "sales", label: "Sales Order", icon: Target },
            { key: "delivery", label: "Delivery Order", icon: Truck },
            { key: "invoice", label: "Invoice", icon: ReceiptText },
            { key: "commission", label: "Komisi", icon: BarChart3 },
            { key: "report", label: "Laporan", icon: FileDown },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                activeTab === tab.key ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={reloadData}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}

      {activeTab === "sales" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Manajemen Sales Order</h2>
              <p className="text-sm text-slate-500">Terhubung ke stok barang dan barcode item.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700"
            >
              <Plus size={16} /> Tambah SO
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-bold">SO</th>
                    <th className="px-4 py-3 font-bold">Customer</th>
                    <th className="px-4 py-3 font-bold">Sales</th>
                    <th className="px-4 py-3 font-bold">Tanggal</th>
                    <th className="px-4 py-3 font-bold">Total</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                    <th className="px-4 py-3 font-bold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.salesOrders.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{row.code}</div>
                        <div className="text-xs text-slate-500">{row.items.length} item</div>
                      </td>
                      <td className="px-4 py-3">{row.customer?.name}</td>
                      <td className="px-4 py-3">{row.salesPerson?.name || "-"}</td>
                      <td className="px-4 py-3">{formatDate(row.orderDate)}</td>
                      <td className="px-4 py-3">{formatCurrency(row.totalAmount)}</td>
                      <td className="px-4 py-3">
                        <select
                          value={row.status}
                          onChange={(event) => handleUpdateSalesStatus(row.id, event.target.value as "DRAFT" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED")}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                        >
                          <option value="DRAFT">DRAFT</option>
                          <option value="CONFIRMED">CONFIRMED</option>
                          <option value="PROCESSING">PROCESSING</option>
                          <option value="SHIPPED">SHIPPED</option>
                          <option value="DELIVERED">DELIVERED</option>
                          <option value="CANCELLED">CANCELLED</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleCreateDO(row.id)}
                            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                          >
                            <Truck size={13} /> DO
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCreateInvoice(row.id)}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                          >
                            <ReceiptText size={13} /> Invoice
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSalesOrder(row.id)}
                            className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-700"
                          >
                            <Trash2 size={13} /> Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {data.salesOrders.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        Belum ada sales order.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "delivery" && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="p-4 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-800">Delivery Order</h2>
            <p className="text-sm text-slate-500">DO dibuat dari Sales Order dan mengurangi stok otomatis.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-bold">DO</th>
                  <th className="px-4 py-3 font-bold">SO</th>
                  <th className="px-4 py-3 font-bold">Customer</th>
                  <th className="px-4 py-3 font-bold">Tanggal</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Detail Barang</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.deliveryOrders.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-semibold text-slate-800">{row.code}</td>
                    <td className="px-4 py-3">{row.salesOrder?.code}</td>
                    <td className="px-4 py-3">{row.customer?.name}</td>
                    <td className="px-4 py-3">{formatDate(row.deliveryDate)}</td>
                    <td className="px-4 py-3">{row.status}</td>
                    <td className="px-4 py-3">
                      <div className="space-y-1 text-xs text-slate-600">
                        {row.items.map((item) => (
                          <div key={item.id}>
                            {item.item.code} | {item.item.name} | Barcode: {item.item.barcode || "-"} | Qty {item.quantity} {item.item.unit}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {data.deliveryOrders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      Belum ada delivery order.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "invoice" && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="p-4 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-800">Invoice Auto dari Sales Order</h2>
            <p className="text-sm text-slate-500">Nomor invoice otomatis mengambil referensi nomor sales order.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-bold">Invoice</th>
                  <th className="px-4 py-3 font-bold">Customer</th>
                  <th className="px-4 py-3 font-bold">Tanggal</th>
                  <th className="px-4 py-3 font-bold">Jatuh Tempo</th>
                  <th className="px-4 py-3 font-bold">Total</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.invoices.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-semibold text-slate-800">{row.invoiceNumber}</td>
                    <td className="px-4 py-3">{row.customer?.name}</td>
                    <td className="px-4 py-3">{formatDate(row.invoiceDate)}</td>
                    <td className="px-4 py-3">{formatDate(row.dueDate)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.totalAmount)}</td>
                    <td className="px-4 py-3">{row.status}</td>
                  </tr>
                ))}
                {data.invoices.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      Belum ada invoice dari sales order.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "commission" && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="p-4 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-800">Komisi Sales Otomatis</h2>
            <p className="text-sm text-slate-500">Komisi dihitung otomatis dari nilai sales order.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-bold">SO</th>
                  <th className="px-4 py-3 font-bold">Sales</th>
                  <th className="px-4 py-3 font-bold">Base</th>
                  <th className="px-4 py-3 font-bold">Rate</th>
                  <th className="px-4 py-3 font-bold">Komisi</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.commissions.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-semibold text-slate-800">{row.salesOrder?.code || "-"}</td>
                    <td className="px-4 py-3">{row.salesPerson?.name || "-"}</td>
                    <td className="px-4 py-3">{formatCurrency(row.baseAmount)}</td>
                    <td className="px-4 py-3">{(row.commissionRate * 100).toFixed(2)}%</td>
                    <td className="px-4 py-3">{formatCurrency(row.totalCommission)}</td>
                    <td className="px-4 py-3">
                      <select
                        value={row.status}
                        onChange={(event) => handleUpdateCommissionStatus(row.id, event.target.value as "PENDING" | "APPROVED" | "PAID" | "CANCELLED")}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="APPROVED">APPROVED</option>
                        <option value="PAID">PAID</option>
                        <option value="CANCELLED">CANCELLED</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {data.commissions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      Belum ada data komisi sales.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "report" && (
        <div className="space-y-4" id="sales-report-print">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Laporan Sales / Marketing</h2>
                <p className="text-sm text-slate-500">Cetak, share WhatsApp, dan PDF per periode.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={handleShareReportWhatsapp} className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-bold text-white hover:bg-green-700">
                  <Send size={15} /> WhatsApp
                </button>
                <button type="button" onClick={printReport} className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800">
                  <Printer size={15} /> Cetak
                </button>
                <button type="button" onClick={downloadReportPdf} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-bold text-white hover:bg-rose-700">
                  <FileDown size={15} /> PDF
                </button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <input type="date" value={reportStart} onChange={(event) => setReportStart(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="date" value={reportEnd} onChange={(event) => setReportEnd(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <button type="button" onClick={handleLoadReport} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700">
                Tampilkan Laporan
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="text-sm text-blue-700">Total Sales Order</div>
              <div className="mt-1 text-2xl font-bold text-blue-900">{report.totals.salesOrderCount}</div>
              <div className="text-xs text-blue-800">{formatCurrency(report.totals.salesOrderAmount)}</div>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
              <div className="text-sm text-indigo-700">Total Delivery Order</div>
              <div className="mt-1 text-2xl font-bold text-indigo-900">{report.totals.deliveryOrderCount}</div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-sm text-emerald-700">Total Invoice</div>
              <div className="mt-1 text-2xl font-bold text-emerald-900">{report.totals.invoiceCount}</div>
              <div className="text-xs text-emerald-800">{formatCurrency(report.totals.invoiceAmount)}</div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="p-4 border-b border-slate-100 font-bold text-slate-800">Rincian Sales Order</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-bold">Kode</th>
                    <th className="px-4 py-3 font-bold">Tanggal</th>
                    <th className="px-4 py-3 font-bold">Customer</th>
                    <th className="px-4 py-3 font-bold">Sales</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                    <th className="px-4 py-3 font-bold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.salesOrders.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-semibold text-slate-800">{row.code}</td>
                      <td className="px-4 py-3">{formatDate(row.orderDate)}</td>
                      <td className="px-4 py-3">{row.customer?.name || "-"}</td>
                      <td className="px-4 py-3">{row.salesPerson?.name || "-"}</td>
                      <td className="px-4 py-3">{row.status}</td>
                      <td className="px-4 py-3">{formatCurrency(row.totalAmount)}</td>
                    </tr>
                  ))}
                  {report.salesOrders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        Tidak ada data sales order pada periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-xl font-bold text-slate-800">Tambah Sales Order</h3>
            <p className="mt-1 text-sm text-slate-500">Pilih customer, sales, dan item stok (dengan barcode).</p>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <select value={customerId} onChange={(event) => setCustomerId(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">Pilih Customer</option>
                {data.customers.map((row) => (
                  <option key={row.id} value={row.id}>{row.code} - {row.name}</option>
                ))}
              </select>
              <select value={salesPersonId} onChange={(event) => setSalesPersonId(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">Pilih Sales</option>
                {data.salesUsers.map((row) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ))}
              </select>
              <input type="date" value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>

            <div className="mt-4 space-y-3">
              {items.map((item, idx) => (
                <div key={`item-${idx}`} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-6">
                  <select
                    value={item.itemId}
                    onChange={(event) => {
                      const selected = data.inventoryItems.find((row) => row.id === event.target.value)
                      setItems((current) =>
                        current.map((row, rowIdx) =>
                          rowIdx === idx
                            ? {
                                ...row,
                                itemId: event.target.value,
                                unitPrice: row.unitPrice || Number(selected?.unitCost || 0),
                              }
                            : row
                        )
                      )
                    }}
                    className="rounded-md border border-slate-300 px-2 py-2 text-xs md:col-span-2"
                  >
                    <option value="">Pilih Barang</option>
                    {data.inventoryItems.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.code} | {row.name} | Barcode: {row.barcode || "-"} | Stok {row.quantity}
                      </option>
                    ))}
                  </select>
                  <input type="number" min={1} value={item.quantity} onChange={(event) => setItems((current) => current.map((row, rowIdx) => (rowIdx === idx ? { ...row, quantity: Number(event.target.value) } : row)))} className="rounded-md border border-slate-300 px-2 py-2 text-xs" placeholder="Qty" />
                  <input type="number" min={0} value={item.unitPrice} onChange={(event) => setItems((current) => current.map((row, rowIdx) => (rowIdx === idx ? { ...row, unitPrice: Number(event.target.value) } : row)))} className="rounded-md border border-slate-300 px-2 py-2 text-xs" placeholder="Harga" />
                  <input type="number" min={0} value={item.discountPercent} onChange={(event) => setItems((current) => current.map((row, rowIdx) => (rowIdx === idx ? { ...row, discountPercent: Number(event.target.value) } : row)))} className="rounded-md border border-slate-300 px-2 py-2 text-xs" placeholder="Disc %" />
                  <input type="number" min={0} value={item.taxPercent} onChange={(event) => setItems((current) => current.map((row, rowIdx) => (rowIdx === idx ? { ...row, taxPercent: Number(event.target.value) } : row)))} className="rounded-md border border-slate-300 px-2 py-2 text-xs" placeholder="Tax %" />
                </div>
              ))}
              <button type="button" onClick={() => setItems((current) => [...current, { ...defaultItemForm }])} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                + Tambah Baris Item
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                <div className="text-slate-500">Subtotal</div>
                <div className="font-bold text-slate-800">{formatCurrency(calculated.subtotal)}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                <div className="text-slate-500">Discount + Tax</div>
                <div className="font-bold text-slate-800">-{formatCurrency(calculated.discountAmount)} + {formatCurrency(calculated.taxAmount)}</div>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3 text-sm">
                <div className="text-emerald-700">Grand Total</div>
                <div className="font-bold text-emerald-900">{formatCurrency(calculated.totalAmount)}</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <input type="number" min={0} value={commissionRate} onChange={(event) => setCommissionRate(Number(event.target.value))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Rate komisi (%)" />
              <input value={notes} onChange={(event) => setNotes(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Catatan" />
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                Batal
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleCreateSalesOrder}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {isPending ? "Menyimpan..." : "Simpan Sales Order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
