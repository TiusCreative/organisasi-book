"use client"

import { useState, useEffect } from "react"
import { Plus, FileText } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Badge } from "@/components/ui/Badge"
import { Modal } from "@/components/ui/Modal"
import { DataTable, ColumnDef } from "@/components/ui/DataTable"
import { getVendorBills, createVendorBill, updateVendorBill, addVendorBillPayment } from "../../app/actions/invoice"
import { getSuppliers } from "../../app/actions/arap"
import { getChartOfAccounts } from "../../app/actions/accounting"

export default function VendorBillManager({ organizationId }: { organizationId: string }) {
  const [vendorBills, setVendorBills] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedBill, setSelectedBill] = useState<any>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const [billsResult, suppliersResult] = await Promise.all([
      getVendorBills(),
      getSuppliers(),
    ])
    if (billsResult.success) setVendorBills(billsResult.vendorBills)
    if (suppliersResult.success) setSuppliers(suppliersResult.suppliers)
    setLoading(false)
  }

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData(e.target as HTMLFormElement)
    
    const items = [{
      description: "Barang/Jasa",
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
    
    await createVendorBill(formData)
    setShowModal(false)
    loadData()
  }

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData(e.target as HTMLFormElement)
    formData.append("vendorBillId", selectedBill.id)
    
    await addVendorBillPayment(formData)
    setShowPaymentModal(false)
    setSelectedBill(null)
    loadData()
  }

  const handleUpdateStatus = async (bill: any, status: string) => {
    const formData = new FormData()
    formData.append("id", bill.id)
    formData.append("status", status)
    
    await updateVendorBill(formData)
    loadData()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: "success" | "danger" | "warning" | "info" | "default" } = {
      DRAFT: "default",
      RECEIVED: "info",
      PARTIALLY_PAID: "warning",
      PAID: "success",
      OVERDUE: "danger",
    }
    return <Badge variant={variants[status] || "default"}>{status.replace("_", " ")}</Badge>
  }

  const columns: ColumnDef<any>[] = [
    {
      header: "Detail",
      cell: (bill) => (
        <div>
          <div className="font-medium text-slate-800">{bill.billNumber}</div>
          <div className="text-xs text-slate-500">{bill.supplier?.name}</div>
          <div className="text-xs text-slate-500">
            {new Date(bill.billDate).toLocaleDateString("id-ID")} - Due: {new Date(bill.dueDate).toLocaleDateString("id-ID")}
          </div>
        </div>
      ),
    },
    {
      header: "Status",
      cell: (bill) => getStatusBadge(bill.status),
    },
    {
      header: "Amount",
      cell: (bill) => (
        <div>
          <div className="font-medium text-slate-800">{formatCurrency(bill.totalAmount)}</div>
          <div className="text-xs text-slate-500">Paid: {formatCurrency(bill.paidAmount)}</div>
          <div className="text-xs text-red-600 font-medium">Rem: {formatCurrency(bill.remainingAmount)}</div>
        </div>
      ),
      className: "text-right",
    },
    {
      header: "Actions",
      cell: (bill) => (
        <div className="flex items-center justify-end gap-1">
          {bill.status === "DRAFT" && (
            <Button
              onClick={() => handleUpdateStatus(bill, "RECEIVED")}
              variant="outline"
              size="sm"
            >
              Terima
            </Button>
          )}
          {(bill.status === "RECEIVED" || bill.status === "PARTIALLY_PAID") && bill.remainingAmount > 0 && (
            <Button
              onClick={() => {
                setSelectedBill(bill)
                setShowPaymentModal(true)
              }}
              variant="outline"
              size="sm"
            >
              Bayar
            </Button>
          )}
        </div>
      ),
      className: "text-right",
    },
  ]

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => setShowModal(true)}
          variant="primary"
        >
          <Plus size={16} />
          Buat Vendor Bill
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={vendorBills}
        isLoading={loading}
        emptyState={
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
            <FileText size={40} className="mx-auto mb-2 opacity-50" />
            <p>Belum ada vendor bill</p>
          </div>
        }
      />

      {/* Create Vendor Bill Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Buat Vendor Bill Baru"
      >
        <form onSubmit={handleCreateBill} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Supplier <span className="text-red-500 ml-1">*</span></label>
            <select
              name="supplierId"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors hover:border-slate-400 bg-white"
            >
              <option value="">Pilih Supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <Input
            label="Tanggal Bill"
            name="billDate"
            type="date"
            required
            defaultValue={new Date().toISOString().split("T")[0]}
          />
          <Input
            label="Jumlah"
            name="amount"
            type="number"
            required
          />
          <div className="flex gap-2 pt-4">
            <Button type="submit" variant="primary" className="flex-1">Buat Bill</Button>
            <Button type="button" onClick={() => setShowModal(false)} variant="outline" className="flex-1">Batal</Button>
          </div>
        </form>
      </Modal>

      {/* Payment Modal */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Tambah Pembayaran"
      >
        {selectedBill && (
          <>
            <div className="mb-4 rounded-lg bg-slate-50 p-4 border border-slate-100">
              <p className="text-sm font-medium text-slate-800">Bill: <span className="font-bold">{selectedBill.billNumber}</span></p>
              <p className="text-sm text-slate-600">Sisa tagihan: <span className="font-bold text-red-600">{formatCurrency(selectedBill.remainingAmount)}</span></p>
            </div>
            <form onSubmit={handleAddPayment} className="space-y-4">
              <Input
                label="Jumlah Pembayaran"
                name="amount"
                type="number"
                required
                max={selectedBill.remainingAmount}
              />
              <Input
                label="Tanggal Pembayaran"
                name="paymentDate"
                type="date"
                required
                defaultValue={new Date().toISOString().split("T")[0]}
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Metode Pembayaran <span className="text-red-500 ml-1">*</span></label>
                <select
                  name="paymentMethod"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors hover:border-slate-400 bg-white"
                >
                  <option value="TRANSFER">Transfer</option>
                  <option value="CASH">Cash</option>
                  <option value="CHECK">Check</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Akun Pengeluaran (Kas/Bank) - Kredit <span className="text-red-500 ml-1">*</span></label>
                <select
                  name="cashAccountId"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors hover:border-slate-400 bg-white"
                >
                  <option value="">Pilih Akun Kas/Bank</option>
                  {accounts.filter(a => a.type === "Asset").map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Akun Hutang Usaha - Debit <span className="text-red-500 ml-1">*</span></label>
                <select
                  name="apAccountId"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors hover:border-slate-400 bg-white"
                >
                  <option value="">Pilih Akun Hutang</option>
                  {accounts.filter(a => a.type === "Liability").map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-4">
                <Button type="submit" variant="primary" className="flex-1">Bayar</Button>
                <Button type="button" onClick={() => setShowPaymentModal(false)} variant="outline" className="flex-1">Batal</Button>
              </div>
            </form>
          </>
        )}
      </Modal>
    </div>
  )
}
