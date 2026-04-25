import { getWarehouseDashboardData } from "@/app/actions/warehouse"
import WarehouseDashboard from "@/components/warehouse/WarehouseDashboard"

export const metadata = {
  title: "Dashboard Gudang | Organisasi Book",
}

export default async function WarehousePage() {
  // Mengambil data agregasi secara langsung di Server Component
  const result = await getWarehouseDashboardData()

  if (!result.success || !result.metrics) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-dashed border-gray-300 p-8 text-center">
        <div>
          <h2 className="text-lg font-bold text-red-600">Gagal memuat data dashboard</h2>
          <p className="mt-2 text-sm text-gray-500">{result.error || "Terjadi kesalahan yang tidak terduga."}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Gudang & Inventori</h1>
          <p className="mt-1 text-sm text-gray-500">Ringkasan pergerakan stok, peringatan stok tipis, dan valuasi persediaan Anda.</p>
        </div>
      </div>

      <WarehouseDashboard 
        metrics={result.metrics}
        lowStockItems={result.lowStockItems || []}
        recentMovements={result.recentMovements || []}
      />
    </div>
  )
}