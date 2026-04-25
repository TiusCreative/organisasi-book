"use client"

import Link from "next/link"

export type DashboardMetrics = {
  totalInventoryValue: number
  lowStockCount: number
  pendingInboundCount: number
  pendingOutboundCount: number
}

export type LowStockItem = {
  id: string
  name: string
  warehouseName: string
  currentStock: number
  minStock: number
}

export type RecentMovement = {
  id: string
  type: "IN" | "OUT" | "ADJUSTMENT" | "TRANSFER"
  itemName: string
  quantity: number
  reference: string | null
  actorName: string
  date: Date
}

type Props = {
  metrics: DashboardMetrics
  lowStockItems: LowStockItem[]
  recentMovements: RecentMovement[]
}

export default function WarehouseDashboard({ metrics, lowStockItems, recentMovements }: Props) {
  // Format ke Rupiah
  const formatRupiah = (amount: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount)

  // Helper untuk warna ikon movement
  const getMovementIcon = (type: string) => {
    switch (type) {
      case "IN": return "🟢"
      case "OUT": return "🔴"
      case "ADJUSTMENT": return "🟡"
      case "TRANSFER": return "🔵"
      default: return "⚪"
    }
  }

  return (
    <div className="space-y-6">
      {/* A. TOP LEVEL: KPI Metrics Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-white p-5 shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-500">Total Nilai Persediaan</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{formatRupiah(metrics.totalInventoryValue)}</p>
          <p className="mt-1 text-xs text-gray-400">Total valuasi seluruh gudang</p>
        </div>
        
        <div className="rounded-lg bg-white p-5 shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-500">Peringatan Stok Tipis</p>
          <p className={`mt-2 text-2xl font-bold ${metrics.lowStockCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {metrics.lowStockCount} Item
          </p>
          <p className="mt-1 text-xs text-gray-400">Berada di bawah batas minimum</p>
        </div>

        <div className="rounded-lg bg-white p-5 shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-500">Pending Inbound (Masuk)</p>
          <p className="mt-2 text-2xl font-bold text-blue-600">{metrics.pendingInboundCount} Dokumen</p>
          <p className="mt-1 text-xs text-gray-400">Menunggu GRN / Putaway</p>
        </div>

        <div className="rounded-lg bg-white p-5 shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-500">Pending Outbound (Keluar)</p>
          <p className="mt-2 text-2xl font-bold text-amber-600">{metrics.pendingOutboundCount} Dokumen</p>
          <p className="mt-1 text-xs text-gray-400">Menunggu Pick / DO</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* B. MIDDLE LEVEL: Actionable Data (Low Stock) - Takes up 2 columns */}
        <div className="lg:col-span-2 rounded-lg bg-white shadow-sm border border-gray-100 flex flex-col">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-base font-semibold text-gray-800">Action Required: Stok Tipis</h2>
          </div>
          <div className="p-0 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-5 py-3 font-medium">Nama Barang</th>
                  <th className="px-5 py-3 font-medium">Gudang</th>
                  <th className="px-5 py-3 font-medium">Sisa Stok</th>
                  <th className="px-5 py-3 font-medium">Min. Stok</th>
                  <th className="px-5 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lowStockItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-gray-500">Semua stok dalam kondisi aman.</td>
                  </tr>
                ) : (
                  lowStockItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-800">{item.name}</td>
                      <td className="px-5 py-3 text-gray-600">{item.warehouseName}</td>
                      <td className="px-5 py-3 font-bold text-red-600">{item.currentStock}</td>
                      <td className="px-5 py-3 text-gray-500">{item.minStock}</td>
                      <td className="px-5 py-3 text-right">
                        <Link 
                          href={`/po/create?itemId=${item.id}`}
                          className="inline-flex items-center rounded bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-100"
                        >
                          Buat PO
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* C. BOTTOM LEVEL: Live Activity Feed - Takes up 1 column */}
        <div className="rounded-lg bg-white shadow-sm border border-gray-100 flex flex-col">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-base font-semibold text-gray-800">Aktivitas Terakhir</h2>
          </div>
          <div className="p-5 flex-1 overflow-y-auto max-h-[400px]">
            <div className="space-y-4">
              {recentMovements.length === 0 ? (
                <p className="text-center text-sm text-gray-500">Belum ada pergerakan barang.</p>
              ) : (
                recentMovements.map((mov) => (
                  <div key={mov.id} className="flex gap-3 text-sm">
                    <div className="mt-0.5 text-lg leading-none">{getMovementIcon(mov.type)}</div>
                    <div>
                      <p className="text-gray-800">
                        <span className="font-semibold">{mov.type}</span>:{" "}
                        <span className={mov.type === "OUT" || mov.quantity < 0 ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
                          {mov.quantity > 0 && mov.type === "IN" ? "+" : ""}{mov.quantity}
                        </span>{" "}
                        pcs <span className="font-medium">{mov.itemName}</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {mov.reference ? `Ref: ${mov.reference} • ` : ""}Oleh {mov.actorName}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{new Date(mov.date).toLocaleString('id-ID')}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}