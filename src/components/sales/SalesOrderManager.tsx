"use client"

import { useState, useEffect } from "react"
import { Plus, Check, Truck, FileText, Send, Trash2 } from "lucide-react"
import { 
  getSalesManagerData, 
  requestSalesOrderApproval, 
  approveSalesOrder, 
  deliverSalesOrder, 
  createSalesInvoice,
  createSalesOrderDraft
} from "@/app/actions/sales-order"

type Customer = { id: string; name: string }
type Warehouse = { id: string; name: string }
type Account = { id: string; code: string; name: string; type: string }
type SalesOrder = {
  id: string
  code: string
  status: string
  totalAmount: number
  customer: Customer
  createdAt: Date
}

export default function SalesOrderManager({ organizationId }: { organizationId: string }) {
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [inventoryItems, setInventoryItems] = useState<any[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  
  // State untuk modal Delivery
  const [showDeliveryModal, setShowDeliveryModal] = useState(false)
  const [selectedSO, setSelectedSO] = useState<string | null>(null)
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("")

  // State untuk modal Buat SO Baru
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newSO, setNewSO] = useState({
    customerId: "", notes: "", commissionRate: 0, items: [{ itemId: "", quantity: 1, unitPrice: 0, taxRate: 11 }] // Default 11% PPN
  })

  // State untuk modal Invoice
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [invoiceAccounts, setInvoiceAccounts] = useState({
    piutangAccountId: "",
    pendapatanAccountId: "",
    ppnAccountId: ""
  })

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await getSalesManagerData(organizationId)
      if (res.success) {
        setSalesOrders(res.salesOrders as any)
        setCustomers(res.customers)
        setWarehouses(res.warehouses)
        setInventoryItems(res.inventoryItems || [])
        setAccounts(res.accounts || [])
        if (res.warehouses.length > 0) {
          setSelectedWarehouseId(res.warehouses[0].id)
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [organizationId])

  const handleRequestApproval = async (id: string) => {
    if (confirm("Ajukan SO ini untuk disetujui?")) {
      await requestSalesOrderApproval(id, organizationId)
      loadData()
    }
  }

  const handleApprove = async (id: string) => {
    if (confirm("Setujui Sales Order ini?")) {
      await approveSalesOrder(id, organizationId)
      loadData()
    }
  }

  const handleDeliver = async () => {
    if (!selectedSO || !selectedWarehouseId) return
    try {
      const res = await deliverSalesOrder(selectedSO, organizationId, selectedWarehouseId)
      if (res.success) {
        setShowDeliveryModal(false)
        setSelectedSO(null)
        loadData()
      } else {
        alert(res.error)
      }
    } catch (e: any) {
      alert(e.message)
    }
  }

  const openInvoiceModal = (id: string) => {
    setSelectedSO(id)
    setShowInvoiceModal(true)
  }

  const handleConfirmInvoice = async () => {
    if (!selectedSO) return
    if (!invoiceAccounts.piutangAccountId || !invoiceAccounts.pendapatanAccountId) {
      return alert("Akun Piutang dan Pendapatan wajib dipilih!")
    }
    setIsSubmitting(true)
    try {
      const res = await createSalesInvoice(selectedSO, organizationId, invoiceAccounts)
      if (res.success) {
        setShowInvoiceModal(false)
        setSelectedSO(null)
        loadData()
        alert("Faktur berhasil dibuat dan jurnal telah dibukukan!")
      } else {
        alert(res.error)
      }
    } catch (e: any) {
      alert(e.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: "bg-slate-100 text-slate-800",
      PENDING_APPROVAL: "bg-amber-100 text-amber-800",
      APPROVED: "bg-blue-100 text-blue-800",
      SHIPPED: "bg-purple-100 text-purple-800",
      INVOICED: "bg-green-100 text-green-800",
    }
    return <span className={`rounded-full px-2 py-1 text-xs font-bold ${styles[status] || "bg-gray-100"}`}>{status}</span>
  }
  
  const handleItemChange = (index: number, field: string, value: any) => {
    const updatedItems = [...newSO.items]
    updatedItems[index] = { ...updatedItems[index], [field]: value }
    setNewSO({ ...newSO, items: updatedItems })
  }

  const handleCreateSO = async () => {
    if (!newSO.customerId) return alert("Pilih pelanggan!")
    const validItems = newSO.items.filter(i => i.itemId && i.quantity > 0)
    if (validItems.length === 0) return alert("Pilih minimal 1 barang dengan kuantitas > 0!")

    setIsSubmitting(true)
    try {
      const res = await createSalesOrderDraft({
        organizationId,
        customerId: newSO.customerId,
        notes: newSO.notes,
        commissionRate: newSO.commissionRate,
        items: validItems
      })
      if (res.success) {
        setShowCreateModal(false)
        setNewSO({
          customerId: "", notes: "", commissionRate: 0, items: [{ itemId: "", quantity: 1, unitPrice: 0, taxRate: 11 }]
        })
        loadData()
        alert("Draft Sales Order berhasil dibuat!")
      } else {
        alert(res.error)
      }
    } catch (e: any) {
      alert(e.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800">Manajemen Penjualan (SO)</h2>
        <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
          <Plus size={16} /> Buat SO Baru
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-slate-500">Memuat data penjualan...</div>
      ) : salesOrders.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
          <p>Belum ada Sales Order yang tercatat.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {salesOrders.map((so) => (
            <div key={so.id} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-bold text-slate-800 text-lg">{so.code}</span>
                  {getStatusBadge(so.status)}
                </div>
                <div className="text-sm text-slate-600">
                  Pelanggan: <span className="font-medium">{so.customer?.name}</span>
                </div>
                <div className="text-sm text-slate-500 mt-1">
                  Tanggal: {new Date(so.createdAt).toLocaleDateString("id-ID")} • Total: Rp {Number(so.totalAmount).toLocaleString("id-ID")}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {so.status === "DRAFT" && (
                  <button 
                    onClick={() => handleRequestApproval(so.id)}
                    className="flex items-center gap-1 rounded-lg border border-amber-600 text-amber-700 px-3 py-1.5 text-sm font-medium hover:bg-amber-50"
                  >
                    <Send size={16} /> Ajukan
                  </button>
                )}

                {so.status === "PENDING_APPROVAL" && (
                  <button 
                    onClick={() => handleApprove(so.id)}
                    className="flex items-center gap-1 rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-emerald-700"
                  >
                    <Check size={16} /> Setujui
                  </button>
                )}

                {so.status === "APPROVED" && (
                  <button 
                    onClick={() => {
                      setSelectedSO(so.id)
                      setShowDeliveryModal(true)
                    }}
                    className="flex items-center gap-1 rounded-lg bg-purple-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-purple-700"
                  >
                    <Truck size={16} /> Kirim Barang (DO)
                  </button>
                )}

                {so.status === "SHIPPED" && (
                  <button 
                    onClick={() => openInvoiceModal(so.id)}
                    className="flex items-center gap-1 rounded-lg bg-blue-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-blue-700"
                  >
                    <FileText size={16} /> Buat Faktur & Jurnal
                  </button>
                )}
                
                {so.status === "INVOICED" && (
                   <span className="text-sm italic text-green-600 font-medium px-2 py-1">
                     Transaksi Selesai & Dibukukan
                   </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Buat SO Baru */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="border-b border-slate-200 px-6 py-4 flex justify-between">
              <h3 className="font-bold text-lg">Buat Draft Sales Order Baru</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-800">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Pelanggan</label>
                <select 
                  value={newSO.customerId}
                  onChange={(e) => setNewSO({ ...newSO, customerId: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Pilih Pelanggan...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Item Barang</label>
                {newSO.items.map((item, idx) => (
                  <div key={idx} className="flex flex-wrap gap-2 mb-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-200">
                    <select 
                      value={item.itemId}
                      onChange={(e) => handleItemChange(idx, "itemId", e.target.value)}
                      className="flex-1 min-w-[200px] rounded-lg border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Pilih Barang...</option>
                      {inventoryItems.map(i => (
                        <option key={i.id} value={i.id}>{i.code} - {i.name}</option>
                      ))}
                    </select>
                    <input 
                      type="number" min="1" placeholder="Qty" value={item.quantity}
                      onChange={(e) => handleItemChange(idx, "quantity", Number(e.target.value))}
                      className="w-24 rounded-lg border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                    <input 
                      type="number" min="0" placeholder="Harga Satuan" value={item.unitPrice}
                      onChange={(e) => handleItemChange(idx, "unitPrice", Number(e.target.value))}
                      className="w-32 rounded-lg border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                    <input 
                      type="number" min="0" placeholder="Tax (%)" value={item.taxRate}
                      onChange={(e) => handleItemChange(idx, "taxRate", Number(e.target.value))}
                      className="w-20 rounded-lg border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                    <button onClick={() => setNewSO({ ...newSO, items: newSO.items.filter((_, i) => i !== idx)})} className="text-red-500 hover:text-red-700 p-2">
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
                <button onClick={() => setNewSO({ ...newSO, items: [...newSO.items, { itemId: "", quantity: 1, unitPrice: 0, taxRate: 11 }] })} className="text-sm font-bold text-blue-600 hover:text-blue-800 mt-1">
                  + Tambah Baris Barang
                </button>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Rate Komisi (%)</label>
                <input 
                  type="number" min="0" max="100" placeholder="Contoh: 5 untuk 5%" value={newSO.commissionRate || ""}
                  onChange={(e) => setNewSO({ ...newSO, commissionRate: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Catatan</label>
                <textarea 
                  value={newSO.notes}
                  onChange={(e) => setNewSO({ ...newSO, notes: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none"
                  rows={3}
                ></textarea>
              </div>
            </div>
            <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-3 bg-slate-50 rounded-b-xl">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg border border-slate-300">Batal</button>
              <button onClick={handleCreateSO} disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
                {isSubmitting ? "Menyimpan..." : "Simpan Draft SO"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Delivery Order */}
      {showDeliveryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-4 flex justify-between">
              <h3 className="font-bold text-lg">Kirim Barang (Delivery Order)</h3>
              <button onClick={() => setShowDeliveryModal(false)} className="text-slate-400 hover:text-slate-800">✕</button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-4">
                Silakan pilih gudang asal barang yang akan dikirim untuk memotong stok persediaan secara otomatis.
              </p>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Pilih Gudang Asal:</label>
                <select 
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-3 bg-slate-50 rounded-b-xl">
              <button 
                onClick={() => setShowDeliveryModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg border border-slate-300"
              >
                Batal
              </button>
              <button 
                onClick={handleDeliver}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg"
              >
                Konfirmasi Pengiriman
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}