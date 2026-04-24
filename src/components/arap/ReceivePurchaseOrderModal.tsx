"use client"

import { useState, useEffect } from "react"
import { receivePurchaseOrder } from "@/app/actions/purchase-order"

type POItem = {
  id: string
  itemId: string | null
  description: string
  quantity: number | string // Decimal dari Prisma biasanya menjadi string/number di client
  receivedQty: number | string
}

type PurchaseOrder = {
  id: string
  poNumber: string
  items: POItem[]
}

type Warehouse = {
  id: string
  name: string
}

type Props = {
  isOpen: boolean
  onClose: () => void
  po: PurchaseOrder
  warehouses: Warehouse[]
}

export default function ReceivePurchaseOrderModal({ isOpen, onClose, po, warehouses }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // State untuk menyimpan input qty dan gudang per item
  const [receiptData, setReceiptData] = useState<Record<string, { quantity: number; warehouseId: string }>>({})

  useEffect(() => {
    if (isOpen) {
      // Inisialisasi state awal: Hanya item yang belum diterima penuh dan memiliki itemId
      const initialData: Record<string, { quantity: number; warehouseId: string }> = {}
      const defaultWarehouseId = warehouses.length > 0 ? warehouses[0].id : ""

      po.items.forEach((item) => {
        const qty = Number(item.quantity)
        const rcv = Number(item.receivedQty)
        if (item.itemId && rcv < qty) {
          initialData[item.id] = {
            quantity: 0, // Default 0, user harus isi
            warehouseId: defaultWarehouseId,
          }
        }
      })
      setReceiptData(initialData)
      setError(null)
    }
  }, [isOpen, po, warehouses])

  if (!isOpen) return null

  const handleQuantityChange = (poItemId: string, val: string, maxQty: number) => {
    const qty = Math.min(Math.max(0, Number(val)), maxQty) // Batasi agar tidak melebihi pesanan
    setReceiptData((prev) => ({
      ...prev,
      [poItemId]: { ...prev[poItemId], quantity: qty },
    }))
  }

  const handleWarehouseChange = (poItemId: string, warehouseId: string) => {
    setReceiptData((prev) => ({
      ...prev,
      [poItemId]: { ...prev[poItemId], warehouseId },
    }))
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      // Filter hanya item yang quantity-nya diisi > 0
      const payload = Object.entries(receiptData)
        .filter(([_, data]) => data.quantity > 0)
        .map(([poItemId, data]) => ({
          poItemId,
          quantity: data.quantity,
          warehouseId: data.warehouseId,
        }))

      if (payload.length === 0) {
        throw new Error("Pilih minimal satu barang dengan kuantitas lebih dari 0 untuk diterima.")
      }

      const result = await receivePurchaseOrder(po.id, payload)
      if (result.success) {
        onClose()
      } else {
        setError("Gagal memproses penerimaan barang.")
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan yang tidak terduga.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl rounded-lg bg-white shadow-xl">
        <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-800">
            Terima Barang (GRN) - {po.poNumber}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
            ✕
          </button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-4 py-2 font-medium">Deskripsi Barang</th>
                <th className="px-4 py-2 font-medium">Dipesan</th>
                <th className="px-4 py-2 font-medium">Sudah Diterima</th>
                <th className="px-4 py-2 font-medium">Terima Saat Ini</th>
                <th className="px-4 py-2 font-medium">Ke Gudang</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {po.items.map((item) => {
                const orderQty = Number(item.quantity)
                const rcvQty = Number(item.receivedQty)
                const remainingQty = orderQty - rcvQty
                const canReceive = item.itemId !== null && remainingQty > 0

                return (
                  <tr key={item.id} className={!canReceive ? "bg-gray-50 opacity-50" : ""}>
                    <td className="px-4 py-3">{item.description}</td>
                    <td className="px-4 py-3">{orderQty}</td>
                    <td className="px-4 py-3">{rcvQty}</td>
                    <td className="px-4 py-3">
                      {canReceive ? (
                        <input
                          type="number"
                          min="0"
                          max={remainingQty}
                          value={receiptData[item.id]?.quantity ?? 0}
                          onChange={(e) => handleQuantityChange(item.id, e.target.value, remainingQty)}
                          className="w-24 rounded-md border border-gray-300 px-2 py-1 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      ) : (
                        <span className="text-xs italic text-gray-500">Selesai / Non-Stok</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {canReceive && (
                        <select
                          value={receiptData[item.id]?.warehouseId ?? ""}
                          onChange={(e) => handleWarehouseChange(item.id, e.target.value)}
                          className="rounded-md border border-gray-300 px-2 py-1 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {warehouses.map((wh) => (
                            <option key={wh.id} value={wh.id}>{wh.name}</option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button onClick={onClose} disabled={isSubmitting} className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 border border-gray-300 disabled:opacity-50">Batal</button>
          <button onClick={handleSubmit} disabled={isSubmitting} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {isSubmitting ? "Memproses..." : "Konfirmasi Penerimaan"}
          </button>
        </div>
      </div>
    </div>
  )
}