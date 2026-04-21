import { Landmark } from "lucide-react"
import DepreciationCalculator from "../../components/DepreciationCalculator"
import { getFixedAssetsWithBookValue } from "../../lib/fixed-assets-ledger"
import Link from "next/link"
import { requireModuleAccess } from "../../lib/auth"

export default async function DepreciationPage() {
  const { organization: activeOrg } = await requireModuleAccess("depreciation")
  const fixedAssets = activeOrg ? await getFixedAssetsWithBookValue(activeOrg.id) : []
  const assets = fixedAssets.map((asset) => ({
    id: asset.id,
    name: asset.name,
    code: asset.code,
    acquisitionDate: new Date(asset.purchase_date),
    acquisitionCost: Number(asset.purchase_price),
    usefulLife: Math.max(1, Math.round(Number(asset.useful_life_months) / 12)),
    residualValue: Number(asset.residual_value),
    depreciationMethod:
      asset.depreciation_method === "DECLINING_BALANCE"
        ? "declining-balance"
        : asset.depreciation_method === "UNITS_OF_PRODUCTION"
          ? "production"
          : "straight-line",
    accumulatedDepreciation: Number(asset.accumulated_depreciation || 0),
  }))

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Penyusutan & Amortisasi</h1>
          <p className="text-slate-500 text-sm">Kelola perhitungan penyusutan aset tetap sesuai standar akuntansi Indonesia</p>
        </div>
        <Link
          href="/aset/tambah"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 shadow-lg transition-all active:scale-95"
        >
          Aset Baru
        </Link>
      </div>

      {/* Fixed Assets List */}
      <div className="grid gap-6">
        {assets.length > 0 ? (
          assets.map((asset) => (
            <DepreciationCalculator key={asset.id} asset={asset} />
          ))
        ) : (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <Landmark className="text-slate-300 size-16 mx-auto mb-4" />
            <p className="text-slate-500 font-bold text-lg">Belum ada aset tetap</p>
            <p className="text-slate-400 text-sm mt-1">Tambahkan aset tetap untuk menghitung penyusutannya.</p>
          </div>
        )}
      </div>

      {/* Depreciation Methods Explanation */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <h2 className="text-xl font-bold text-slate-800">Metode Penyusutan</h2>
        
        <div className="grid md:grid-cols-3 gap-4">
          <div className="border-l-4 border-blue-600 pl-4">
            <h3 className="font-bold text-slate-700 mb-2">Garis Lurus (Straight-Line)</h3>
            <p className="text-sm text-slate-600">
              Beban penyusutan sama setiap tahun. Formula: (Harga Perolehan - Nilai Sisa) / Umur Ekonomis
            </p>
          </div>
          
          <div className="border-l-4 border-emerald-600 pl-4">
            <h3 className="font-bold text-slate-700 mb-2">Saldo Menurun (Declining Balance)</h3>
            <p className="text-sm text-slate-600">
              Beban penyusutan lebih besar di awal tahun. Cocok untuk aset teknologi yang cepat obsolete.
            </p>
          </div>
          
          <div className="border-l-4 border-rose-600 pl-4">
            <h3 className="font-bold text-slate-700 mb-2">Berbasis Produksi</h3>
            <p className="text-sm text-slate-600">
              Beban penyusutan berdasarkan kapasitas produksi aset. Cocok untuk mesin produksi.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
