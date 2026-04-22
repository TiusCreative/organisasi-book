"use client"

import { useState } from "react"
import { createWorkOrder, updateWorkOrderStatus } from "@/app/actions/work-order"
import { useRouter } from "next/navigation"

interface WorkOrder {
  id: string
  code: string
  barcode?: string
  title: string
  description?: string
  status: string
  priority: string
  assignedTo?: string
  startDate?: string
  dueDate?: string
  createdAt: string
  assignedUser?: { id: string; name: string }
  customer?: { id: string; name: string; code: string }
  items?: any[]
}

interface User {
  id: string
  name: string
}

interface Customer {
  id: string
  name: string
  code: string
}

interface WorkOrderManagerProps {
  initialWorkOrders: WorkOrder[]
  users: User[]
  customers: Customer[]
  organizationId: string
}

export default function WorkOrderManager({ initialWorkOrders, users, customers, organizationId }: WorkOrderManagerProps) {
  const [workOrders, setWorkOrders] = useState(initialWorkOrders)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null)
  const [formData, setFormData] = useState({
    code: "",
    barcode: "",
    title: "",
    description: "",
    customerId: "",
    priority: "MEDIUM",
    assignedTo: "",
    startDate: "",
    dueDate: "",
    estimatedHours: "",
    items: [] as { description: string; quantity: string; unit: string; unitPrice: string }[]
  })

  const router = useRouter()

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createWorkOrder({
        organizationId,
        code: formData.code,
        barcode: formData.barcode || undefined,
        title: formData.title,
        description: formData.description || undefined,
        customerId: formData.customerId || undefined,
        priority: formData.priority,
        assignedTo: formData.assignedTo || undefined,
        startDate: formData.startDate ? new Date(formData.startDate) : undefined,
        dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
        estimatedHours: formData.estimatedHours ? parseFloat(formData.estimatedHours) : undefined,
        items: formData.items.map(i => ({
          description: i.description,
          quantity: parseFloat(i.quantity),
          unit: i.unit,
          unitPrice: parseFloat(i.unitPrice)
        }))
      })
      setIsCreateOpen(false)
      setFormData({
        code: "",
        barcode: "",
        title: "",
        description: "",
        customerId: "",
        priority: "MEDIUM",
        assignedTo: "",
        startDate: "",
        dueDate: "",
        estimatedHours: "",
        items: []
      })
      router.refresh()
    } catch (error) {
      console.error("Error creating work order:", error)
    }
  }

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: "", quantity: "1", unit: "pcs", unitPrice: "0" }]
    })
  }

  const handleItemChange = (index: number, field: string, value: string) => {
    const newItems = [...formData.items]
    newItems[index][field as keyof typeof newItems[0]] = value
    setFormData({ ...formData, items: newItems })
  }

  const handleRemoveItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    })
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateWorkOrderStatus(id, status)
      router.refresh()
    } catch (error) {
      console.error("Error updating status:", error)
    }
  }

  const printWorkOrder = (wo: WorkOrder) => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    
    printWindow.document.write(`
      <html>
        <head><title>Work Order - ${wo.code}</title></head>
        <body>
          <h1>Work Order: ${wo.code}</h1>
          <h2>${wo.title}</h2>
          <p>Status: ${wo.status}</p>
          <p>Priority: ${wo.priority}</p>
          <p>Assigned To: ${wo.assignedUser?.name || '-'}</p>
          ${wo.description ? `<p>Description: ${wo.description}</p>` : ''}
          ${wo.items && wo.items.length > 0 ? `
            <h3>Items:</h3>
            <table border="1" cellpadding="10">
              <tr><th>Description</th><th>Quantity</th><th>Unit</th><th>Unit Price</th><th>Total</th></tr>
              ${wo.items.map(item => `
                <tr>
                  <td>${item.description}</td>
                  <td>${item.quantity}</td>
                  <td>${item.unit}</td>
                  <td>${item.unitPrice}</td>
                  <td>${item.totalPrice}</td>
                </tr>
              `).join('')}
            </table>
          ` : ''}
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const shareWhatsApp = (wo: WorkOrder) => {
    const text = `Work Order ${wo.code}\n\nTitle: ${wo.title}\nStatus: ${wo.status}\nPriority: ${wo.priority}\n\n${wo.description || ''}`
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  const downloadPDF = (wo: WorkOrder) => {
    // Simple text-based PDF download
    const content = `Work Order: ${wo.code}\nTitle: ${wo.title}\nStatus: ${wo.status}\nPriority: ${wo.priority}\nAssigned To: ${wo.assignedUser?.name || '-'}\n\nDescription:\n${wo.description || '-'}\n\nItems:\n${wo.items?.map(i => `- ${i.description}: ${i.quantity} ${i.unit} @ ${i.unitPrice}`).join('\n') || '-'}`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `WO-${wo.code}.txt`
    a.click()
  }

  const generateBarcode = (code: string) => {
    // Simple barcode simulation - in production use a barcode library
    return code.replace(/[^A-Z0-9]/g, '').toUpperCase()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Daftar Work Order</h2>
          <p className="text-sm text-slate-500">Kelola pekerjaan dan penugasan tim</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Buat Work Order
        </button>
      </div>

      <div className="grid gap-4">
        {workOrders.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <p className="text-center text-slate-500">Belum ada work order</p>
          </div>
        ) : (
          workOrders.map((wo) => (
            <div key={wo.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{wo.code}</h3>
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                      {wo.priority}
                    </span>
                  </div>
                  <p className="font-medium">{wo.title}</p>
                  <p className="text-sm text-slate-500">{wo.description}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  wo.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                  wo.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-700" :
                  wo.status === "CANCELLED" ? "bg-red-100 text-red-700" :
                  "bg-yellow-100 text-yellow-700"
                }`}>
                  {wo.status}
                </span>
              </div>

              {wo.barcode && (
                <div className="mb-3 p-2 bg-slate-50 rounded font-mono text-sm">
                  Barcode: {wo.barcode}
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm mb-4">
                <div>
                  <span className="text-slate-500">Assigned:</span>
                  <p className="font-medium">{wo.assignedUser?.name || '-'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Customer:</span>
                  <p className="font-medium">{wo.customer?.name || '-'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Due Date:</span>
                  <p className="font-medium">{wo.dueDate ? new Date(wo.dueDate).toLocaleDateString('id-ID') : '-'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Est. Hours:</span>
                  <p className="font-medium">{wo.estimatedHours || '-'}</p>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <select
                  value={wo.status}
                  onChange={(e) => handleStatusChange(wo.id, e.target.value)}
                  className="px-3 py-1 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="PENDING">PENDING</option>
                  <option value="IN_PROGRESS">IN PROGRESS</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
                <button
                  onClick={() => printWorkOrder(wo)}
                  className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm"
                >
                  Cetak
                </button>
                <button
                  onClick={() => shareWhatsApp(wo)}
                  className="px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm"
                >
                  WhatsApp
                </button>
                <button
                  onClick={() => downloadPDF(wo)}
                  className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm"
                >
                  PDF
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Buat Work Order Baru</h3>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Kode</label>
                  <input
                    placeholder="WO-2024-001"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Barcode (Opsional)</label>
                  <input
                    placeholder="Auto-generate jika kosong"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Judul</label>
                <input
                  placeholder="Servis AC Gedung A"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Deskripsi</label>
                <textarea
                  placeholder="Deskripsi lengkap pekerjaan..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Customer</label>
                  <select
                    value={formData.customerId}
                    onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="">Pilih Customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Assigned To</label>
                  <select
                    value={formData.assignedTo}
                    onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="">Pilih User</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Est. Hours</label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="0"
                    value={formData.estimatedHours}
                    onChange={(e) => setFormData({ ...formData, estimatedHours: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Date</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Due Date</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium">Items</label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    + Tambah Item
                  </button>
                </div>
                {formData.items.map((item, index) => (
                  <div key={index} className="grid grid-cols-4 gap-2 mb-2">
                    <input
                      placeholder="Deskripsi"
                      value={item.description}
                      onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      required
                    />
                    <input
                      type="number"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      required
                    />
                    <input
                      placeholder="Unit"
                      value={item.unit}
                      onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                    <div className="flex gap-1">
                      <input
                        type="number"
                        placeholder="Price"
                        value={item.unitPrice}
                        onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="px-2 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                      >
                        X
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
