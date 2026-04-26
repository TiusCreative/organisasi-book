"use client"

import { useState, useEffect, useRef } from "react"
import { Plus, Share2, Download, FileText, Trash2, Check, X, Printer } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Badge } from "@/components/ui/Badge"
import { Modal } from "@/components/ui/Modal"
import { DataTable, ColumnDef } from "@/components/ui/DataTable"
import ImageUpload from "@/components/ui/ImageUpload"
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
import { getDocumentTemplate } from "../../app/actions/document-template"
import DynamicPrintLayout from "../settings/DynamicPrintLayout"
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
  const [templateHtml, setTemplateHtml] = useState<string>("")
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [posResult, suppliersResult, warehousesResult, templateResult] = await Promise.all([
      getPurchaseOrders(),
      getSuppliers(),
      getWarehouses(),
      getDocumentTemplate("PO"),
    ])
    if (posResult.success) setPos(posResult.purchaseOrders)
    if (suppliersResult.success) setSuppliers(suppliersResult.suppliers)
    if (warehousesResult?.success) setWarehouses(warehousesResult.warehouses)
    if (templateResult.success && templateResult.template) setTemplateHtml(templateResult.template.contentHtml)
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

  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: "success" | "danger" | "warning" | "info" | "default" } = {
      DRAFT: "default",
      PENDING_APPROVAL: "warning",
      APPROVED: "success",
      REJECTED: "danger",
      SENT: "info",
      RECEIVED: "success",
      PARTIALLY_RECEIVED: "warning",
      CLOSED: "default",
    }
    return <Badge variant={variants[status] || "default"}>{status.replace("_", " ")}</Badge>
  }

  const columns: ColumnDef<PurchaseOrderRow>[] = [
    {
      header: "Detail",
      cell: (po) => (
        <div>
          <div className="font-medium text-slate-800">{po.poNumber}</div>
          <div className="text-xs text-slate-500">{po.supplier?.name}</div>
          <div className="text-xs text-slate-500">{new Date(po.orderDate).toLocaleDateString("id-ID")}</div>
        </div>
      ),
    },
    {
      header: "Status",
      cell: (po) => getStatusBadge(po.status),
    },
    {
      header: "Total",
      cell: (po) => <div className="font-medium">{formatCurrency(Number(po.totalAmount || 0))}</div>,
      className: "text-right",
    },
    {
      header: "Actions",
      cell: (po) => (
        <div className="flex items-center justify-end gap-1">
          {po.status === "DRAFT" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                submitPurchaseOrderForApproval(po.id).then(loadData).catch((e) => alert(e?.message || String(e)))
              }}
              title="Ajukan approval"
            >
              Ajukan
            </Button>
          )}

          {po.status === "PENDING_APPROVAL" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                onClick={() => {
                  const note = window.prompt("Catatan approval (opsional):") || ""
                  approvePurchaseOrder(po.id, note).then(loadData).catch((e) => alert(e?.message || String(e)))
                }}
                title="Approve"
              >
                <Check size={16} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-700 hover:bg-red-50 hover:text-red-800"
                onClick={() => {
                  const note = window.prompt("Alasan reject (opsional):") || ""
                  rejectPurchaseOrder(po.id, note).then(loadData).catch((e) => alert(e?.message || String(e)))
                }}
                title="Reject"
              >
                <X size={16} />
              </Button>
            </>
          )}

          {po.status === "APPROVED" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const formData = new FormData()
                formData.append("id", po.id)
                formData.append("status", "SENT")
                updatePurchaseOrderStatus(formData).then(loadData).catch((e) => alert(e?.message || String(e)))
              }}
            >
              Kirim
            </Button>
          )}

          {(po.status === "APPROVED" || po.status === "SENT" || po.status === "PARTIALLY_RECEIVED") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedPO(po)
                setShowReceiveModal(true)
              }}
            >
              Terima
            </Button>
          )}
          <Button
            onClick={() => handleShareWhatsApp(po)}
            variant="ghost"
            size="sm"
            className="text-green-600 hover:bg-green-50"
            title="Share WhatsApp"
          >
            <Share2 size={16} />
          </Button>
          
          {templateHtml ? (
            <DynamicPrintLayout
              templateHtml={templateHtml}
              data={{
                ...po,
                date: new Date(po.orderDate).toLocaleDateString("id-ID"),
                supplierName: po.supplier?.name,
              }}
              documentTitle={`PO_${po.poNumber}`}
              customButton={
                <Button variant="ghost" size="sm" className="text-blue-600 hover:bg-blue-50" title="Cetak PO (Template Custom)"><Printer size={16} /></Button>
              }
            />
          ) : (
            <Button
              onClick={() => handleDownloadPDF(po)}
              variant="ghost"
              size="sm"
              className="text-blue-600 hover:bg-blue-50"
              title="Cetak PO (Template Standar)"
            >
              <Download size={16} />
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
          Buat PO Baru
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={pos}
        isLoading={loading}
        emptyState={
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
            <FileText size={40} className="mx-auto mb-2 opacity-50" />
            <p>Belum ada Purchase Order</p>
          </div>
        }
      />

      {/* Create PO Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Buat Purchase Order Baru"
        maxWidth="4xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Supplier</label>
                  <div className="flex gap-2">
                    <select
                      name="supplierId"
                      required
                      className="flex-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors hover:border-slate-400"
                    >
                      <option value="">Pilih Supplier</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      onClick={() => setShowSupplierModal(true)}
                      variant="outline"
                      title="Tambah Supplier Baru"
                    >
                      <Plus size={16} />
                    </Button>
                  </div>
                </div>
                <div>
                  <Input
                    label="Tanggal Order"
                    name="orderDate"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().split("T")[0]}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Items</label>
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <Input
                        type="text"
                        placeholder="Deskripsi"
                        value={item.description}
                        onChange={(e) => handleItemChange(index, "description", e.target.value)}
                        className="flex-1"
                        required
                      />
                      <Input
                        type="number"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, "quantity", parseFloat(e.target.value))}
                        className="w-20"
                        required
                      />
                      <Input
                        type="number"
                        placeholder="Harga"
                        value={item.unitPrice}
                        onChange={(e) => handleItemChange(index, "unitPrice", parseFloat(e.target.value))}
                        className="w-32"
                        required
                      />
                      <Input
                        type="number"
                        placeholder="Diskon %"
                        value={item.discount}
                        onChange={(e) => handleItemChange(index, "discount", parseFloat(e.target.value))}
                        className="w-24"
                      />
                      <Button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 mt-1"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button type="button" onClick={handleAddItem} variant="ghost" className="mt-2 text-blue-600">
                  + Tambah Item
                </Button>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Catatan</label>
                <textarea
                  name="notes"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors hover:border-slate-400"
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" variant="primary" className="flex-1">
                  Buat PO
                </Button>
                <Button type="button" onClick={() => setShowModal(false)} variant="outline" className="flex-1">
                  Batal
                </Button>
              </div>
        </form>
      </Modal>

      {/* Create Supplier Modal */}
      <Modal
        isOpen={showSupplierModal}
        onClose={() => setShowSupplierModal(false)}
        title="Tambah Supplier Baru"
      >
        <form onSubmit={handleCreateSupplier} className="space-y-4">
          <Input label="Nama" name="name" required />
          <Input label="Email" name="email" type="email" />
          <Input label="Telepon" name="phone" />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Alamat</label>
            <textarea
              name="address"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors hover:border-slate-400"
              rows={2}
            />
          </div>
          <div className="flex gap-2 pt-4">
            <Button type="submit" variant="primary" className="flex-1">
              Simpan
            </Button>
            <Button type="button" onClick={() => setShowSupplierModal(false)} variant="outline" className="flex-1">
              Batal
            </Button>
          </div>
        </form>
      </Modal>

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
