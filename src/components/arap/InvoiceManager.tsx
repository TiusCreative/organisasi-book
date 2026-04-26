"use client"

import { useState, useEffect, useRef } from "react"
import { Plus, DollarSign, Share2, Download, Printer } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Badge } from "@/components/ui/Badge"
import { Modal } from "@/components/ui/Modal"
import { DataTable, ColumnDef } from "@/components/ui/DataTable"
import { getInvoices, createInvoice, updateInvoice, addInvoicePayment } from "../../app/actions/invoice"
import { getCustomers } from "../../app/actions/arap"
import { getChartOfAccounts } from "../../app/actions/accounting"
import { getDocumentTemplate } from "../../app/actions/document-template"
import DynamicPrintLayout from "../settings/DynamicPrintLayout"

export default function InvoiceManager({ organizationId }: { organizationId: string }) {
  const [invoices, setInvoices] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [templateHtml, setTemplateHtml] = useState<string>("")
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const [invoicesResult, customersResult, templateResult] = await Promise.all([
      getInvoices(),
      getCustomers(),
      getDocumentTemplate("INVOICE")
    ])
    if (invoicesResult.success) setInvoices(invoicesResult.invoices)
    if (customersResult.success) setCustomers(customersResult.customers)
    if (templateResult.success && templateResult.template) setTemplateHtml(templateResult.template.contentHtml)
    setLoading(false)
  }

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData(e.target as HTMLFormElement)
    
    const items = [{
      description: "Jasa/Layanan",
      quantity: 1,
      unitPrice: parseFloat(formData.get("amount") as string),
      discount: 0,
      taxRate: 0.11,
      subtotal: parseFloat(formData.get("amount") as string),
      taxAmount: parseFloat(formData.get("amount") as string) * 0.11,
      total: parseFloat(formData.get("amount") as string) * 1.11,
    }]
    
    formData.append("items", JSON.stringify(items))
    formData.append("paymentTerm", "30")
    
    await createInvoice(formData)
    setShowModal(false)
    loadData()
  }

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData(e.target as HTMLFormElement)
    formData.append("invoiceId", selectedInvoice.id)
    
    await addInvoicePayment(formData)
    setShowPaymentModal(false)
    setSelectedInvoice(null)
    loadData()
  }

  const handleUpdateStatus = async (invoice: any, status: string) => {
    const formData = new FormData()
    formData.append("id", invoice.id)
    formData.append("status", status)
    
    await updateInvoice(formData)
    loadData()
  }

  const handleShareWhatsApp = (invoice: any) => {
    const customer = invoice.customer
    const message = `*INVOICE*\n\nNomor: ${invoice.invoiceNumber}\nTanggal: ${new Date(invoice.invoiceDate).toLocaleDateString("id-ID")}\nJatuh Tempo: ${new Date(invoice.dueDate).toLocaleDateString("id-ID")}\nTotal: Rp ${invoice.totalAmount.toLocaleString("id-ID")}\nSisa: Rp ${invoice.remainingAmount.toLocaleString("id-ID")}\n\nMohon segera melakukan pembayaran.`
    
    const phone = customer?.phone?.replace(/\D/g, "")
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank")
    } else {
      alert("Nomor telepon customer tidak tersedia")
    }
  }

  const handleDownloadPDF = (invoice: any) => {
    setSelectedInvoice(invoice)
    setTimeout(() => {
      window.print()
    }, 100)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
        >
          <Plus size={16} />
          Buat Invoice
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-slate-500">Loading...</div>
      ) : invoices.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
          <DollarSign size={40} className="mx-auto mb-2 opacity-50" />
          <p>Belum ada invoice</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800">{invoice.invoiceNumber}</span>
                  <span className="text-xs text-slate-500">{invoice.customer?.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      invoice.status === "PAID" ? "bg-green-100 text-green-800" :
                      invoice.status === "PARTIALLY_PAID" ? "bg-yellow-100 text-yellow-800" :
                      invoice.status === "OVERDUE" ? "bg-red-100 text-red-800" :
                      "bg-slate-100 text-slate-800"
                    }`}
                  >
                    {invoice.status}
                  </span>
                </div>
                <div className="text-sm text-slate-600">
                  {new Date(invoice.invoiceDate).toLocaleDateString("id-ID")} - Due: {new Date(invoice.dueDate).toLocaleDateString("id-ID")}
                </div>
                <div className="text-sm font-medium text-slate-800">
                  Total: Rp {invoice.totalAmount.toLocaleString("id-ID")} | Paid: Rp {invoice.paidAmount.toLocaleString("id-ID")} | Remaining: Rp {invoice.remainingAmount.toLocaleString("id-ID")}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleShareWhatsApp(invoice)}
                  className="rounded-lg p-2 text-green-600 hover:bg-green-50"
                  title="Share WhatsApp"
                >
                  <Share2 size={16} />
                </button>
                
                {templateHtml ? (
                  <DynamicPrintLayout
                    templateHtml={templateHtml}
                    data={{
                      ...invoice,
                      date: new Date(invoice.invoiceDate).toLocaleDateString("id-ID"),
                      customerName: invoice.customer?.name,
                    }}
                    documentTitle={`Invoice_${invoice.invoiceNumber}`}
                    customButton={
                      <button className="rounded-lg p-2 text-blue-600 hover:bg-blue-50" title="Cetak (Template Custom)"><Printer size={16} /></button>
                    }
                  />
                ) : (
                  <button
                    onClick={() => handleDownloadPDF(invoice)}
                    className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                    title="Cetak (Template Standar)"
                  >
                    <Printer size={16} />
                  </button>
                )}
                {invoice.status === "DRAFT" && (
                  <button
                    onClick={() => handleUpdateStatus(invoice, "SENT")}
                    className="rounded-lg px-3 py-1.5 text-sm font-bold text-emerald-600 hover:bg-emerald-50"
                  >
                    Kirim
                  </button>
                )}
                {(invoice.status === "SENT" || invoice.status === "PARTIALLY_PAID") && invoice.remainingAmount > 0 && (
                  <button
                    onClick={() => {
                      setSelectedInvoice(invoice)
                      setShowPaymentModal(true)
                    }}
                    className="rounded-lg px-3 py-1.5 text-sm font-bold text-blue-600 hover:bg-blue-50"
                  >
                    Bayar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Invoice Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Buat Invoice Baru</h3>
            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer</label>
                <select
                  name="customerId"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Pilih Customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Invoice</label>
                <input
                  name="invoiceDate"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().split("T")[0]}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Jumlah</label>
                <input
                  name="amount"
                  type="number"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                >
                  Buat Invoice
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Tambah Pembayaran</h3>
            <p className="text-sm text-slate-600 mb-4">
              Invoice: {selectedInvoice.invoiceNumber}<br />
              Sisa: Rp {selectedInvoice.remainingAmount.toLocaleString("id-ID")}
            </p>
            <form onSubmit={handleAddPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Jumlah Pembayaran</label>
                <input
                  name="amount"
                  type="number"
                  required
                  max={selectedInvoice.remainingAmount}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Pembayaran</label>
                <input
                  name="paymentDate"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().split("T")[0]}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Metode Pembayaran</label>
                <select
                  name="paymentMethod"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="TRANSFER">Transfer</option>
                  <option value="CASH">Cash</option>
                  <option value="CHECK">Check</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Akun Penerimaan (Kas/Bank) - Debit</label>
                <select
                  name="cashAccountId"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Pilih Akun Kas/Bank</option>
                  {accounts.filter(a => a.type === "Asset").map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Akun Piutang - Kredit</label>
                <select
                  name="arAccountId"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Pilih Akun Piutang</option>
                  {accounts.filter(a => a.type === "Asset").map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
                >
                  Bayar
                </button>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print Template (Hidden) */}
      <div ref={printRef} className="hidden print:block p-8">
        {selectedInvoice && (
          <div className="bg-white p-8">
            <h1 className="text-2xl font-bold text-slate-800 mb-4">INVOICE</h1>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="font-bold">Nomor Invoice:</p>
                <p>{selectedInvoice.invoiceNumber}</p>
              </div>
              <div>
                <p className="font-bold">Tanggal:</p>
                <p>{new Date(selectedInvoice.invoiceDate).toLocaleDateString("id-ID")}</p>
              </div>
              <div>
                <p className="font-bold">Jatuh Tempo:</p>
                <p>{new Date(selectedInvoice.dueDate).toLocaleDateString("id-ID")}</p>
              </div>
            </div>
            <div className="mb-6">
              <p className="font-bold">Customer:</p>
              <p>{selectedInvoice.customer?.name}</p>
              <p>{selectedInvoice.customer?.address}</p>
            </div>
            <table className="w-full border-collapse mb-6">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Deskripsi</th>
                  <th className="text-right py-2">Qty</th>
                  <th className="text-right py-2">Harga</th>
                  <th className="text-right py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {selectedInvoice.items?.map((item: any) => (
                  <tr key={item.id} className="border-b">
                    <td className="py-2">{item.description}</td>
                    <td className="text-right py-2">{item.quantity}</td>
                    <td className="text-right py-2">{formatCurrency(parseFloat(item.unitPrice))}</td>
                    <td className="text-right py-2">{formatCurrency(parseFloat(item.total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-right">
              <p className="font-bold">Subtotal: {formatCurrency(parseFloat(selectedInvoice.subtotal))}</p>
              <p className="font-bold">Tax: {formatCurrency(parseFloat(selectedInvoice.taxAmount))}</p>
              <p className="font-bold text-lg">Total: {formatCurrency(parseFloat(selectedInvoice.totalAmount))}</p>
              <p className="text-slate-600">Paid: {formatCurrency(parseFloat(selectedInvoice.paidAmount))}</p>
              <p className="font-bold text-emerald-600">Remaining: {formatCurrency(parseFloat(selectedInvoice.remainingAmount))}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
