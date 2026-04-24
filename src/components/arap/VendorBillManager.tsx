"use client"

import { useState, useEffect } from "react"
import { Plus, DollarSign } from "lucide-react"
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

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-700"
        >
          <Plus size={16} />
          Buat Vendor Bill
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-slate-500">Loading...</div>
      ) : vendorBills.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
          <DollarSign size={40} className="mx-auto mb-2 opacity-50" />
          <p>Belum ada vendor bill</p>
        </div>
      ) : (
        <div className="space-y-2">
          {vendorBills.map((bill) => (
            <div
              key={bill.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800">{bill.billNumber}</span>
                  <span className="text-xs text-slate-500">{bill.supplier?.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      bill.status === "PAID" ? "bg-green-100 text-green-800" :
                      bill.status === "PARTIALLY_PAID" ? "bg-yellow-100 text-yellow-800" :
                      bill.status === "OVERDUE" ? "bg-red-100 text-red-800" :
                      "bg-slate-100 text-slate-800"
                    }`}
                  >
                    {bill.status}
                  </span>
                </div>
                <div className="text-sm text-slate-600">
                  {new Date(bill.billDate).toLocaleDateString("id-ID")} - Due: {new Date(bill.dueDate).toLocaleDateString("id-ID")}
                </div>
                <div className="text-sm font-medium text-slate-800">
                  Total: Rp {bill.totalAmount.toLocaleString("id-ID")} | Paid: Rp {bill.paidAmount.toLocaleString("id-ID")} | Remaining: Rp {bill.remainingAmount.toLocaleString("id-ID")}
                </div>
              </div>
              <div className="flex gap-2">
                {bill.status === "DRAFT" && (
                  <button
                    onClick={() => handleUpdateStatus(bill, "RECEIVED")}
                    className="rounded-lg px-3 py-1.5 text-sm font-bold text-orange-600 hover:bg-orange-50"
                  >
                    Terima
                  </button>
                )}
                {(bill.status === "RECEIVED" || bill.status === "PARTIALLY_PAID") && bill.remainingAmount > 0 && (
                  <button
                    onClick={() => {
                      setSelectedBill(bill)
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

      {/* Create Vendor Bill Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Buat Vendor Bill Baru</h3>
            <form onSubmit={handleCreateBill} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Supplier</label>
                <select
                  name="supplierId"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Pilih Supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Bill</label>
                <input
                  name="billDate"
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
                  className="flex-1 rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-700"
                >
                  Buat Bill
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
      {showPaymentModal && selectedBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Tambah Pembayaran</h3>
            <p className="text-sm text-slate-600 mb-4">
              Bill: {selectedBill.billNumber}<br />
              Sisa: Rp {selectedBill.remainingAmount.toLocaleString("id-ID")}
            </p>
            <form onSubmit={handleAddPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Jumlah Pembayaran</label>
                <input
                  name="amount"
                  type="number"
                  required
                  max={selectedBill.remainingAmount}
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Akun Pengeluaran (Kas/Bank) - Kredit</label>
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Akun Hutang Usaha - Debit</label>
                <select
                  name="apAccountId"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Pilih Akun Hutang</option>
                  {accounts.filter(a => a.type === "Liability").map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
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
    </div>
  )
}
