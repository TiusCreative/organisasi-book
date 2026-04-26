"use client"

import { useState, useEffect } from "react"
import { Plus, Check, Truck, FileText, Send, Trash2, Printer } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Badge } from "@/components/ui/Badge"
import { Modal } from "@/components/ui/Modal"
import { DataTable, ColumnDef } from "@/components/ui/DataTable"
import { Alert } from "@/components/ui/Alert"
import { 
  getSalesManagerData, 
  requestSalesOrderApproval, 
  approveSalesOrder, 
  deliverSalesOrder, 
  createSalesInvoice,
  createSalesOrderDraft
} from "@/app/actions/sales-order"
import { getDocumentTemplate } from "@/app/actions/document-template"
import DynamicPrintLayout from "@/components/settings/DynamicPrintLayout"

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

  // State untuk template DO
  const [doTemplateHtml, setDoTemplateHtml] = useState<string>("")
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [selectedSOForPrint, setSelectedSOForPrint] = useState<any>(null)

  // State Notification Alert / Toast
  const [alertMessage, setAlertMessage] = useState<{type: "success"|"error"|"warning"|"info", text: string} | null>(null)
  const showAlert = (type: "success"|"error"|"warning"|"info", text: string) => {
    setAlertMessage({ type, text })
    setTimeout(() => setAlertMessage(null), 5000)
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const [res, templateRes] = await Promise.all([
        getSalesManagerData(organizationId),
        getDocumentTemplate("DO")
      ])
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
      if (templateRes.success && templateRes.template) {
        setDoTemplateHtml(templateRes.template.contentHtml)
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
        showAlert("error", res.error || "Gagal memproses Delivery Order")
      }
    } catch (e: any) {
      showAlert("error", e.message)
    }
  }

  const openInvoiceModal = (id: string) => {
    setSelectedSO(id)
    setShowInvoiceModal(true)
  }

  const handleConfirmInvoice = async () => {
    if (!selectedSO) return
    if (!invoiceAccounts.piutangAccountId || !invoiceAccounts.pendapatanAccountId) {
      showAlert("error", "Akun Piutang dan Pendapatan wajib dipilih!")
      return
    }
    setIsSubmitting(true)
    try {
      const res = await createSalesInvoice(selectedSO, organizationId, invoiceAccounts)
      if (res.success) {
        setShowInvoiceModal(false)
        setSelectedSO(null)
        loadData()
        showAlert("success", "Faktur berhasil dibuat dan jurnal telah dibukukan!")
      } else {
        showAlert("error", res.error || "Gagal membuat faktur")
      }
    } catch (e: any) {
      showAlert("error", e.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, "default" | "warning" | "info" | "success" | "danger"> = {
      DRAFT: "default",
      PENDING_APPROVAL: "warning",
      APPROVED: "info",
      SHIPPED: "warning",
      INVOICED: "success",
    }
    return <Badge variant={styles[status] || "default"}>{status.replace("_", " ")}</Badge>
  }

  const columns: ColumnDef<SalesOrder>[] = [
    {
      header: "Detail SO",
      cell: (so) => (
        <div>
          <div className="font-bold text-slate-800">{so.code}</div>
          <div className="text-xs text-slate-500">{so.customer?.name}</div>
          <div className="text-xs text-slate-400 mt-0.5">{new Date(so.createdAt).toLocaleDateString("id-ID")}</div>
        </div>
      ),
    },
    {
      header: "Status",
      cell: (so) => getStatusBadge(so.status),
    },
    {
      header: "Total",
      cell: (so) => <div className="font-medium text-slate-800">Rp {Number(so.totalAmount).toLocaleString("id-ID")}</div>,
      className: "text-right",
    },
    {
      header: "Aksi",
      cell: (so) => (
        <div className="flex flex-wrap items-center justify-end gap-1">
          {so.status === "DRAFT" && (
            <Button variant="outline" size="sm" onClick={() => handleRequestApproval(so.id)} className="text-amber-700 hover:bg-amber-50">
              <Send size={14} className="mr-1" /> Ajukan
            </Button>
          )}
          {so.status === "PENDING_APPROVAL" && (
            <Button variant="primary" size="sm" onClick={() => handleApprove(so.id)} className="bg-emerald-600 hover:bg-emerald-700 border-none">
              <Check size={14} className="mr-1" /> Setujui
            </Button>
          )}
          {so.status === "APPROVED" && (
            <Button variant="primary" size="sm" onClick={() => { setSelectedSO(so.id); setShowDeliveryModal(true); }} className="bg-purple-600 hover:bg-purple-700 border-none">
              <Truck size={14} className="mr-1" /> Kirim (DO)
            </Button>
          )}
          {so.status === "SHIPPED" && (
            <>
              <Button variant="outline" size="sm" onClick={() => handlePrintDO(so)}>
                <Printer size={14} className="mr-1" /> Cetak DO
              </Button>
              <Button variant="primary" size="sm" onClick={() => openInvoiceModal(so.id)} className="bg-blue-600 hover:bg-blue-700 border-none">
                <FileText size={14} className="mr-1" /> Buat Faktur
              </Button>
            </>
          )}
          {so.status === "INVOICED" && (
             <span className="text-xs italic text-green-600 font-medium px-2 py-1">Selesai & Dibukukan</span>
          )}
        </div>
      ),
      className: "text-right",
    }
  ]
  
  const handleItemChange = (index: number, field: string, value: any) => {
    const updatedItems = [...newSO.items]
    updatedItems[index] = { ...updatedItems[index], [field]: value }
    setNewSO({ ...newSO, items: updatedItems })
  }

  const handleCreateSO = async () => {
    if (!newSO.customerId) return showAlert("error", "Pilih pelanggan!")
    const validItems = newSO.items.filter(i => i.itemId && i.quantity > 0)
    if (validItems.length === 0) return showAlert("error", "Pilih minimal 1 barang dengan kuantitas > 0!")

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
        showAlert("success", "Draft Sales Order berhasil dibuat!")
      } else {
        showAlert("error", res.error || "Gagal membuat Draft SO")
      }
    } catch (e: any) {
      showAlert("error", e.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePrintDO = (so: any) => {
    setSelectedSOForPrint(so)
    setShowPrintModal(true)
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 relative">
      {/* Toast Notification */}
      {alertMessage && (
        <div className="fixed top-6 right-6 z-[100] animate-in fade-in slide-in-from-top-4">
          <Alert variant={alertMessage.type} onClose={() => setAlertMessage(null)} className="shadow-lg min-w-[300px] bg-white">
            {alertMessage.text}
          </Alert>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800">Manajemen Penjualan (SO)</h2>
        <Button onClick={() => setShowCreateModal(true)} variant="primary">
          <Plus size={16} /> Buat SO Baru
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={salesOrders}
        isLoading={loading}
        emptyState={
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
            <FileText size={40} className="mx-auto mb-2 opacity-50" />
            <p>Belum ada Sales Order yang tercatat.</p>
          </div>
        }
      />

      {/* Modal Buat SO Baru */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Buat Draft Sales Order Baru"
        maxWidth="4xl"
      >
        <div className="space-y-6">
              
              {/* Seksi Informasi Umum */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Pelanggan</label>
                  <select 
                    value={newSO.customerId}
                    onChange={(e) => setNewSO({ ...newSO, customerId: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50"
                  >
                    <option value="">-- Pilih Pelanggan --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500">Pilih pelanggan yang akan memesan barang</p>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Rate Komisi Sales (%)</label>
                  <Input 
                    type="number" min="0" max="100" placeholder="0" value={newSO.commissionRate || ""}
                    onChange={(e) => setNewSO({ ...newSO, commissionRate: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-500">Persentase komisi untuk sales (opsional)</p>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700">Catatan / Terms (Opsional)</label>
                  <textarea 
                    value={newSO.notes}
                    onChange={(e) => setNewSO({ ...newSO, notes: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    rows={2}
                    placeholder="Tuliskan catatan tambahan untuk pelanggan..."
                  ></textarea>
                  <p className="text-xs text-slate-500">Catatan tambahan atau syarat pembayaran</p>
                </div>
              </div>

              {/* Seksi Daftar Barang */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h4 className="font-bold text-slate-800 mb-4 text-base">Rincian Barang</h4>
                <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-xs text-blue-700"><strong>Keterangan Kolom:</strong></p>
                  <ul className="text-xs text-blue-600 mt-1 space-y-1">
                    <li>• <strong>Item/Barang:</strong> Pilih produk dari master barang</li>
                    <li>• <strong>Kuantitas:</strong> Jumlah barang yang dipesan</li>
                    <li>• <strong>Harga Satuan:</strong> Harga per unit barang (Rp)</li>
                    <li>• <strong>Pajak (%):</strong> PPN/Pajak penjualan (default 11%)</li>
                  </ul>
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-100 text-slate-600">
                      <tr>
                        <th className="p-3 font-semibold w-1/3">Item / Barang</th>
                        <th className="p-3 font-semibold w-24">Kuantitas</th>
                        <th className="p-3 font-semibold">Harga Satuan (Rp)</th>
                        <th className="p-3 font-semibold w-24">Pajak (%)</th>
                        <th className="p-3 font-semibold text-center w-16">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {newSO.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2">
                            <select 
                              value={item.itemId}
                              onChange={(e) => handleItemChange(idx, "itemId", e.target.value)}
                              className="w-full rounded-md border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
                            >
                              <option value="">-- Pilih Barang --</option>
                              {inventoryItems.map(i => (
                                <option key={i.id} value={i.id}>{i.code} - {i.name}</option>
                              ))}
                            </select>
                            <p className="text-[10px] text-slate-400 mt-1">Pilih produk</p>
                          </td>
                          <td className="p-2">
                            <Input 
                              type="number" min="1" placeholder="1" value={item.quantity}
                              onChange={(e) => handleItemChange(idx, "quantity", Number(e.target.value))}
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Jumlah</p>
                          </td>
                          <td className="p-2">
                            <Input 
                              type="number" min="0" placeholder="0" value={item.unitPrice}
                              onChange={(e) => handleItemChange(idx, "unitPrice", Number(e.target.value))}
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Harga/unit</p>
                          </td>
                          <td className="p-2">
                            <Input 
                              type="number" min="0" placeholder="11" value={item.taxRate}
                              onChange={(e) => handleItemChange(idx, "taxRate", Number(e.target.value))}
                            />
                            <p className="text-[10px] text-slate-400 mt-1">PPN %</p>
                          </td>
                          <td className="p-2 text-center">
                            <Button 
                              variant="ghost"
                              size="sm"
                              type="button"
                              onClick={() => setNewSO({ ...newSO, items: newSO.items.filter((_, i) => i !== idx)})} 
                              className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded-md transition-colors"
                              title="Hapus Baris"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                <div className="mt-4">
                  <Button 
                    variant="ghost"
                    type="button"
                    onClick={() => setNewSO({ ...newSO, items: [...newSO.items, { itemId: "", quantity: 1, unitPrice: 0, taxRate: 11 }] })} 
                    className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors"
                  >
                    <Plus size={16} /> Tambah Baris Barang
                  </Button>
                </div>
              </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => setShowCreateModal(false)}>Batal</Button>
          <Button variant="primary" onClick={handleCreateSO} isLoading={isSubmitting}>Simpan Draft SO</Button>
        </div>
    </Modal>

      {/* Modal Delivery Order */}
      <Modal
        isOpen={showDeliveryModal}
        onClose={() => setShowDeliveryModal(false)}
        title="Kirim Barang (Delivery Order)"
      >
        <div className="space-y-4">
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
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowDeliveryModal(false)}>Batal</Button>
            <Button variant="primary" onClick={handleDeliver} className="bg-purple-600 hover:bg-purple-700">Konfirmasi Pengiriman</Button>
          </div>
        </div>
      </Modal>

      {/* Modal Invoice */}
      <Modal
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        title="Buat Faktur & Jurnal"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Pilih akun untuk pembukuan jurnal otomatis faktur penjualan ini.
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Akun Piutang <span className="text-red-500">*</span></label>
            <select
              value={invoiceAccounts.piutangAccountId}
              onChange={(e) => setInvoiceAccounts({...invoiceAccounts, piutangAccountId: e.target.value})}
              className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none bg-white hover:border-slate-400 transition-colors"
            >
              <option value="">-- Pilih Akun Piutang --</option>
              {accounts.filter(a => a.type === "Asset").map(a => (
                <option key={a.id} value={a.id}>[{a.code}] {a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Akun Pendapatan <span className="text-red-500">*</span></label>
            <select
              value={invoiceAccounts.pendapatanAccountId}
              onChange={(e) => setInvoiceAccounts({...invoiceAccounts, pendapatanAccountId: e.target.value})}
              className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none bg-white hover:border-slate-400 transition-colors"
            >
              <option value="">-- Pilih Akun Pendapatan --</option>
              {accounts.filter(a => a.type === "Revenue").map(a => (
                <option key={a.id} value={a.id}>[{a.code}] {a.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowInvoiceModal(false)}>Batal</Button>
            <Button variant="primary" onClick={handleConfirmInvoice} isLoading={isSubmitting}>Konfirmasi & Bukukan</Button>
          </div>
        </div>
      </Modal>

      {/* Modal Print DO */}
      <Modal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="Cetak Delivery Order"
        maxWidth="4xl"
      >
        {selectedSOForPrint && (
          <div className="space-y-4">
              {doTemplateHtml ? (
                <DynamicPrintLayout
                  templateHtml={doTemplateHtml}
                  data={{
                    doNumber: selectedSOForPrint.deliveryOrder?.doCode || `DO-${selectedSOForPrint.code}`,
                    customerName: selectedSOForPrint.customer?.name,
                    date: new Date().toLocaleDateString("id-ID"),
                    driverName: "Driver",
                    items: selectedSOForPrint.items || [],
                    total: selectedSOForPrint.totalAmount
                  }}
                  documentTitle={`DO-${selectedSOForPrint.code}`}
                />
              ) : (
                <div className="text-center text-slate-500 py-8">
                  Template DO belum diatur. Silakan atur di Pengaturan > Template Dokumen.
                </div>
              )}
            </div>
        )}
      </Modal>
    </div>
  )
}