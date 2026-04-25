"use client"

import { useState } from "react"
import { createSalesReturn } from "@/app/actions/sales-order"
import { useRouter } from "next/navigation"

type InvoiceItem = {
  id: string
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
  // Asumsi ada itemId di data InvoiceItem Anda (jika null, bukan barang inventori)
  itemId?: string | null 
}

type Props = {
  organizationId: string
  invoiceId: string
  invoiceNumber: string
  items: InvoiceItem[]
  warehouses: { id: string; name: string }[]
  accounts: { id: string; code: string; name: string; type: string }[] // Filtered AR accounts
}

export default function SalesReturnForm({ organizationId, invoiceId, invoiceNumber, items, warehouses, accounts }: Props) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [warehouseId, setWarehouseId] = useState("")
  const [piutangAccountId, setPiutangAccountId] = useState("")
  
  // State untuk menyimpan kuantitas yang di-retur
  const [returnQty, setReturnQty] = useState<Record<string, number>>({})

  const handleQtyChange = (itemId: string, val: string, maxQty: number) => {
    const qty = Math.min(Math.max(0, Number(val)), maxQty)
    setReturnQty(prev => ({ ...prev, [itemId]: qty }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!warehouseId) return setError("Gudang penerima retur wajib dipilih.")
    if (!piutangAccountId) return setError("Akun piutang wajib dipilih.")

    const returnedItems = items
      .filter(item => item.itemId && (returnQty[item.id] || 0) > 0)
      .map(item => ({
        itemId: item.itemId as string,
        quantity: returnQty[item.id] || 0,
        unitPrice: item.unitPrice,
        unitCost: item.unitPrice, // Idealnya ini ambil nilai HPP (Average/FIFO) dari DB, disederhanakan pakai harga jual sementara atau hitung di backend.
        taxRate: item.taxRate
      }))

    if (returnedItems.length === 0) {
      return setError("Masukkan kuantitas retur lebih dari 0 pada minimal satu item.")
    }

    setIsSubmitting(true)
    try {
      const result = await createSalesReturn(
        invoiceId,
        organizationId,
        warehouseId,
        piutangAccountId,
        returnedItems
      )

      if (result.success) {
        router.push(`/organization/${organizationId}/sales`)
      } else {
        setError(result.error || "Gagal memproses retur penjualan.")
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan sistem.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="mb-6 flex justify-between items-center border-b pb-4">
        <h2 className="text-xl font-bold text-gray-800">Retur Penjualan - {invoiceNumber}</h2>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-md text-sm font-medium">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Gudang Penerima Retur</label>
          <select
            required
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="w-full rounded-md border border-gray-300 p-2.5 text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">-- Pilih Gudang --</option>
            {warehouses.map(wh => (
              <option key={wh.id} value={wh.id}>{wh.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Akun Piutang (Untuk Dipotong)</label>
          <select
            required
            value={piutangAccountId}
            onChange={(e) => setPiutangAccountId(e.target.value)}
            className="w-full rounded-md border border-gray-300 p-2.5 text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">-- Pilih Akun --</option>
            {accounts.filter(a => a.type === "Asset").map(acc => (
              <option key={acc.id} value={acc.id}>[{acc.code}] {acc.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-md mb-6">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-4 py-3 font-medium">Qty Asli</th>
              <th className="px-4 py-3 font-medium">Harga Satuan</th>
              <th className="px-4 py-3 font-medium">Qty Retur</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map(item => (
              <tr key={item.id}>
                <td className="px-4 py-3">{item.description}</td>
                <td className="px-4 py-3">{item.quantity}</td>
                <td className="px-4 py-3">Rp {item.unitPrice.toLocaleString('id-ID')}</td>
                <td className="px-4 py-3">
                  <input type="number" min="0" max={item.quantity} value={returnQty[item.id] || ''} onChange={(e) => handleQtyChange(item.id, e.target.value, item.quantity)} className="w-24 p-1.5 border rounded-md" placeholder="0" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={isSubmitting} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-md font-medium disabled:opacity-50 transition-colors">
          {isSubmitting ? "Memproses..." : "Proses Retur & Jurnal"}
        </button>
      </div>
    </form>
  )
}