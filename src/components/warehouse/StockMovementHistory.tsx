"use client"

import { useState, useEffect } from "react"
import { getInventoryMovements } from "@/app/actions/warehouse"
import { ArrowDownRight, ArrowUpRight, RefreshCw } from "lucide-react"

type InventoryMovementRow = {
  id: string
  movementType: string
  quantity: number
  reference: string | null
  description: string | null
  createdAt: Date
  item: {
    code: string
    name: string
    unit: string
  }
}

export default function StockMovementHistory() {
  const [movements, setMovements] = useState<InventoryMovementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<string>("")

  const loadData = async () => {
    setLoading(true)
    const result = await getInventoryMovements(filterType ? { type: filterType } : undefined)
    if (result.success) {
      setMovements(result.movements as any)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [filterType])

  const getMovementIcon = (type: string) => {
    switch (type) {
      case "IN": return <ArrowDownRight className="text-green-500" size={18} />
      case "OUT": return <ArrowUpRight className="text-red-500" size={18} />
      case "ADJUSTMENT": return <RefreshCw className="text-amber-500" size={18} />
      default: return <RefreshCw className="text-slate-500" size={18} />
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-bold text-slate-800">Riwayat Pergerakan Stok (Ledger)</h2>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">Semua Tipe</option>
          <option value="IN">Masuk (IN)</option>
          <option value="OUT">Keluar (OUT)</option>
          <option value="ADJUSTMENT">Penyesuaian (ADJUSTMENT)</option>
        </select>
      </div>

      {loading ? (
        <div className="py-8 text-center text-slate-500">Memuat data histori...</div>
      ) : movements.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
          <p>Belum ada pergerakan stok yang tercatat.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3 font-medium">Waktu</th>
                <th className="px-4 py-3 font-medium">Tipe</th>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium text-right">Kuantitas</th>
                <th className="px-4 py-3 font-medium">Referensi</th>
                <th className="px-4 py-3 font-medium">Deskripsi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {movements.map((mov) => (
                <tr key={mov.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    {new Date(mov.createdAt).toLocaleString("id-ID")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-medium">
                      {getMovementIcon(mov.movementType)}
                      {mov.movementType}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-slate-800">{mov.item.name}</span>
                    <br />
                    <span className="text-xs text-slate-500">{mov.item.code}</span>
                  </td>
                  <td className={`px-4 py-3 text-right font-bold ${mov.movementType === 'IN' ? 'text-green-600' : mov.movementType === 'OUT' ? 'text-red-600' : 'text-slate-700'}`}>
                    {mov.movementType === 'OUT' ? '-' : '+'}{mov.quantity} {mov.item.unit}
                  </td>
                  <td className="px-4 py-3 font-medium">{mov.reference || "-"}</td>
                  <td className="px-4 py-3 text-xs">{mov.description || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}