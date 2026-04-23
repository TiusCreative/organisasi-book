import { Plus, Building2, ArrowLeft } from "lucide-react"
import Link from "next/link"
import DeleteFixedAssetButton from "../../components/DeleteFixedAssetButton"
import { getFixedAssetsWithBookValue } from "../../lib/fixed-assets-ledger"
import { requireModuleAccess } from "../../lib/auth"

export default async function AsetPage() {
  const { organization: activeOrg } = await requireModuleAccess("assets")

  if (!activeOrg) {
    return (
      <div className="max-w-full lg:max-w-6xl mx-auto px-4 sm:px-0">
        <h1 className="text-2xl font-bold text-slate-800">Daftar Aset</h1>
        <p className="text-slate-500 mt-2">Belum ada organisasi. Silakan buat organisasi terlebih dahulu.</p>
      </div>
    )
  }

  const assets = await getFixedAssetsWithBookValue(activeOrg.id)

  const totalAssets = assets.reduce((sum, asset) => sum + Number(asset.purchase_price || 0), 0)

  return (
    <div className="max-w-full lg:max-w-6xl mx-auto px-4 sm:px-0 space-y-6">
      <div className="mb-6">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors">
          <ArrowLeft size={20} />
          <span>Kembali ke Dashboard</span>
        </Link>
      </div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Daftar Aset</h1>
          <p className="text-slate-500 text-sm mt-1">Kelola aset dan penyusutan perusahaan</p>
        </div>
        <Link
          href="/aset/tambah"
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold text-sm"
        >
          <Plus size={20} /> Tambah Aset
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-slate-500 text-xs sm:text-sm font-bold">Total Aset</p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-2">{assets.length}</p>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-slate-500 text-xs sm:text-sm font-bold">Total Nilai Perolehan</p>
          <p className="text-lg sm:text-xl font-bold text-slate-800 mt-2 font-mono">
            Rp {totalAssets.toLocaleString('id-ID')}
          </p>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-slate-500 text-xs sm:text-sm font-bold">Aktif</p>
          <p className="text-2xl sm:text-3xl font-bold text-green-600 mt-2">
            {assets.filter((asset) => asset.status === 'ACTIVE').length}
          </p>
        </div>
      </div>

      {/* Assets List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {assets.length === 0 ? (
          <div className="text-center py-12 sm:py-16">
            <Building2 className="mx-auto text-slate-300 mb-4" size={40} />
            <p className="text-slate-500 font-bold text-base sm:text-lg">Belum Ada Aset</p>
            <p className="text-slate-400 text-sm mt-1">Mulai dengan menambahkan aset perusahaan</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-left text-xs sm:text-sm font-bold text-slate-700">
                  <th className="px-4 sm:px-6 py-3">Nama Aset</th>
                  <th className="hidden sm:table-cell px-4 sm:px-6 py-3">Kategori</th>
                  <th className="hidden md:table-cell px-4 sm:px-6 py-3">Nilai Perolehan</th>
                  <th className="hidden lg:table-cell px-4 sm:px-6 py-3">Masa Manfaat</th>
                  <th className="px-4 sm:px-6 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 sm:px-6 py-4">
                      <div>
                        <p className="font-bold text-slate-800 text-sm sm:text-base">{asset.name}</p>
                        <p className="text-xs sm:text-sm text-slate-500 sm:hidden">{asset.category}</p>
                        <p className="text-xs text-slate-400 mt-1">{asset.code}</p>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-4 sm:px-6 py-4 text-sm text-slate-700">
                      {asset.category}
                    </td>
                    <td className="hidden md:table-cell px-4 sm:px-6 py-4 font-mono font-bold text-slate-800 text-sm">
                      Rp {Number(asset.purchase_price).toLocaleString('id-ID')}
                    </td>
                    <td className="hidden lg:table-cell px-4 sm:px-6 py-4 text-sm text-slate-700">
                      {Math.max(1, Math.round(Number(asset.useful_life_months) / 12))} tahun
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-right">
                      <div className="flex flex-col sm:flex-row gap-2 justify-end">
                        <DeleteFixedAssetButton assetId={asset.id} assetName={asset.name} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
