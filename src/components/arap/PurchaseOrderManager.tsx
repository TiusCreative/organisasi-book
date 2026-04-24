"use client"

import { useState, useEffect, useRef } from "react"
import { Plus, Share2, Download, FileText, Trash2, Check, X } from "lucide-react"
import {
  getPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
  submitPurchaseOrderForApproval,
  approvePurchaseOrder,
  rejectPurchaseOrder,
} from "../../app/actions/purchase-order"
import { getSuppliers, createSupplier } from "../../app/actions/arap"
import { getWarehouses } from "../../app/actions/warehouse"
import ReceivePurchaseOrderModal from "./ReceivePurchaseOrderModal"

type Supplier = {
  id: string
  name: string
  phone?: string | null
  address?: string | null
}

type PurchaseOrderItemInput = {
  description: string
  quantity: number
  unitPrice: number
  discount: number
  taxRate: number
}

type PurchaseOrderItemRow = {
  id: string
  description: string
  quantity: number
  unitPrice: string | number
  total: string | number
}

type PurchaseOrderRow = {
  id: string
  poNumber: string
  orderDate: string | Date
  status: string
  totalAmount: string | number
  supplier?: Supplier | null
  items?: PurchaseOrderItemRow[]
}

export default function PurchaseOrderManager({ organizationId: _organizationId }: { organizationId: string }) {
  void _organizationId
  const [pos, setPos] = useState<PurchaseOrderRow[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [showReceiveModal, setShowReceiveModal] = useState(false)
  const [selectedPO, setSelectedPO] = useState<PurchaseOrderRow | null>(null)
  const [items, setItems] = useState<PurchaseOrderItemInput[]>([
    { description: "", quantity: 1, unitPrice: 0, discount: 0, taxRate: 11 },
  ])
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [posResult, suppliersResult, warehousesResult] = await Promise.all([
      getPurchaseOrders(),
      getSuppliers(),
      getWarehouses(),
    ])
    if (posResult.success) setPos(posResult.purchaseOrders)
    if (suppliersResult.success) setSuppliers(suppliersResult.suppliers)
    if (warehousesResult?.success) setWarehouses(warehousesResult.warehouses)
    setLoading(false)
  }

  const handleAddItem = () => {
    setItems([...items, { description: "", quantity: 1, unitPrice: 0, discount: 0, taxRate: 11 }])
  }

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleItemChange = (index: number, field: keyof PurchaseOrderItemInput, value: PurchaseOrderItemInput[keyof PurchaseOrderItemInput]) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value } as PurchaseOrderItemInput
    setItems(newItems)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData(e.target as HTMLFormElement)
    formData.append("items", JSON.stringify(items))
    
    await createPurchaseOrder(formData)
    setShowModal(false)
    setItems([{ description: "", quantity: 1, unitPrice: 0, discount: 0, taxRate: 11 }])
    loadData()
  }

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData(e.target as HTMLFormElement)
    
    await createSupplier(formData)
    setShowSupplierModal(false)
    loadData()
  }

  const handleShareWhatsApp = (po: PurchaseOrderRow) => {
    const supplier = po.supplier
    const message = `*PURCHASE ORDER*\n\nNomor: ${po.poNumber}\nTanggal: ${new Date(po.orderDate).toLocaleDateString("id-ID")}\nTotal: Rp ${po.totalAmount.toLocaleString("id-ID")}\n\nMohon konfirmasi pesanan ini.`
    
    const phone = supplier?.phone?.replace(/\D/g, "")
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank")
    } else {
      alert("Nomor telepon supplier tidak tersedia")
    }
  }

  const handleDownloadPDF = (po: PurchaseOrderRow) => {
    setSelectedPO(po)
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
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          Buat PO Baru
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-slate-500">Loading...</div>
      ) : pos.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
          <FileText size={40} className="mx-auto mb-2 opacity-50" />
          <p>Belum ada Purchase Order</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pos.map((po) => (
            <div
              key={po.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800">{po.poNumber}</span>
                  <span className="text-xs text-slate-500">{po.supplier?.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      po.status === "DRAFT" ? "bg-slate-100 text-slate-800" :
                      po.status === "PENDING_APPROVAL" ? "bg-amber-100 text-amber-800" :
                      po.status === "APPROVED" ? "bg-emerald-100 text-emerald-800" :
                      po.status === "REJECTED" ? "bg-red-100 text-red-800" :
                      po.status === "SENT" ? "bg-blue-100 text-blue-800" :
                      po.status === "RECEIVED" ? "bg-green-100 text-green-800" :
                      "bg-red-100 text-red-800"
                    }`}
                  >
                    {po.status}
                  </span>
                </div>
                <div className="text-sm text-slate-600">
                  {new Date(po.orderDate).toLocaleDateString("id-ID")}
                </div>
                <div className="text-sm font-medium text-slate-800">
                  Total: {formatCurrency(Number(po.totalAmount || 0))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleShareWhatsApp(po)}
                  className="rounded-lg p-2 text-green-600 hover:bg-green-50"
                  title="Share WhatsApp"
                >
                  <Share2 size={16} />
                </button>
                <button
                  onClick={() => handleDownloadPDF(po)}
                  className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                  title="Download PDF"
                >
                  <Download size={16} />
                </button>
                {po.status === "DRAFT" && (
                  <button
                    onClick={() => {
                      submitPurchaseOrderForApproval(po.id).then(loadData).catch((e) => alert(e?.message || String(e)))
                    }}
                    className="rounded-lg px-3 py-1.5 text-sm font-bold text-amber-700 hover:bg-amber-50"
                    title="Ajukan approval"
                  >
                    Ajukan
                  </button>
                )}

                {po.status === "PENDING_APPROVAL" && (
                  <>
                    <button
                      onClick={() => {
                        const note = window.prompt("Catatan approval (opsional):") || ""
                        approvePurchaseOrder(po.id, note).then(loadData).catch((e) => alert(e?.message || String(e)))
                      }}
                      className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
                      title="Approve"
                    >
                      <Check size={16} />
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        const note = window.prompt("Alasan reject (opsional):") || ""
                        rejectPurchaseOrder(po.id, note).then(loadData).catch((e) => alert(e?.message || String(e)))
                      }}
                      className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-bold text-red-700 hover:bg-red-50"
                      title="Reject"
                    >
                      <X size={16} />
                      Reject
                    </button>
                  </>
                )}

                {po.status === "APPROVED" && (
                  <button
                    onClick={() => {
                      const formData = new FormData()
                      formData.append("id", po.id)
                      formData.append("status", "SENT")
                      updatePurchaseOrderStatus(formData).then(loadData).catch((e) => alert(e?.message || String(e)))
                    }}
                    className="rounded-lg px-3 py-1.5 text-sm font-bold text-blue-600 hover:bg-blue-50"
                  >
                    Kirim
                  </button>
                )}

                {(po.status === "APPROVED" || po.status === "SENT" || po.status === "PARTIALLY_RECEIVED") && (
                  <button
                    onClick={() => {
                      setSelectedPO(po)
                      setShowReceiveModal(true)
                    }}
                    className="rounded-lg px-3 py-1.5 text-sm font-bold text-purple-600 hover:bg-purple-50"
                  >
                    Terima
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create PO Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Buat Purchase Order Baru</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Supplier</label>
                  <div className="flex gap-2">
                    <select
                      name="supplierId"
                      required
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">Pilih Supplier</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowSupplierModal(true)}
                      className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200"
                      title="Tambah Supplier Baru"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Order</label>
                  <input
                    name="orderDate"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().split("T")[0]}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Items</label>
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <input
                        type="text"
                        placeholder="Deskripsi"
                        value={item.description}
                        onChange={(e) => handleItemChange(index, "description", e.target.value)}
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        required
                      />
                      <input
                        type="number"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, "quantity", parseFloat(e.target.value))}
                        className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        required
                      />
                      <input
                        type="number"
                        placeholder="Harga"
                        value={item.unitPrice}
                        onChange={(e) => handleItemChange(index, "unitPrice", parseFloat(e.target.value))}
                        className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        required
                      />
                      <input
                        type="number"
                        placeholder="Diskon %"
                        value={item.discount}
                        onChange={(e) => handleItemChange(index, "discount", parseFloat(e.target.value))}
                        className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                >
                  + Tambah Item
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Catatan</label>
                <textarea
                  name="notes"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
                >
                  Buat PO
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

      {/* Create Supplier Modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Tambah Supplier Baru</h3>
            <form onSubmit={handleCreateSupplier} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama</label>
                <input
                  name="name"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  name="email"
                  type="email"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Telepon</label>
                <input
                  name="phone"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Alamat</label>
                <textarea
                  name="address"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
                >
                  Simpan
                </button>
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
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
        {selectedPO && (
          <div className="bg-white p-8">
            <h1 className="text-2xl font-bold text-slate-800 mb-4">PURCHASE ORDER</h1>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="font-bold">Nomor PO:</p>
                <p>{selectedPO.poNumber}</p>
              </div>
              <div>
                <p className="font-bold">Tanggal:</p>
                <p>{new Date(selectedPO.orderDate).toLocaleDateString("id-ID")}</p>
              </div>
            </div>
            <div className="mb-6">
              <p className="font-bold">Supplier:</p>
              <p>{selectedPO.supplier?.name}</p>
              <p>{selectedPO.supplier?.address}</p>
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
                {(selectedPO.items || []).map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="py-2">{item.description}</td>
                    <td className="text-right py-2">{item.quantity}</td>
                    <td className="text-right py-2">{formatCurrency(Number(item.unitPrice || 0))}</td>
                    <td className="text-right py-2">{formatCurrency(Number(item.total || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-right">
              <p className="font-bold">Total: {formatCurrency(Number(selectedPO.totalAmount || 0))}</p>
            </div>
          </div>
        )}
      </div>

      {/* Receive Purchase Order (GRN) Modal */}
      {showReceiveModal && selectedPO && (
        <ReceivePurchaseOrderModal
          isOpen={showReceiveModal}
          onClose={() => {
            setShowReceiveModal(false)
            setSelectedPO(null)
            loadData() // Reload POs list after receiving goods
          }}
          po={selectedPO as any}
          warehouses={warehouses}
        />
      )}
    </div>
  )
}
