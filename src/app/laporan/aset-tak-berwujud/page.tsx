import { requireCurrentOrganization, requireModuleAccess } from "@/lib/auth"
import { FileText } from "lucide-react"
import IntangibleAssetsReport from "@/components/reports/IntangibleAssetsReport"

export default async function AsetTakBerwujudPage() {
  await requireModuleAccess("reports")
  const { organization: activeOrg } = await requireCurrentOrganization()

  if (!activeOrg) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-0">
        <h1 className="text-2xl font-bold text-slate-800">Aset Tak Berwujud</h1>
        <p className="text-slate-500 mt-2">Belum ada organisasi. Silakan buat organisasi terlebih dahulu.</p>
      </div>
    )
  }

  return (
    <div className="max-w-full lg:max-w-7xl mx-auto px-4 sm:px-0 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">Aset Tak Berwujud</h1>
        <p className="text-slate-500 text-sm mt-1">{activeOrg.name}</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-3 flex-col sm:flex-row">
          <FileText size={24} className="text-purple-600" />
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800">Laporan Aset Tak Berwujud</h2>
            <p className="text-xs sm:text-sm text-slate-500">Daftar aset tak berwujud + akumulasi amortisasi + nilai buku</p>
          </div>
        </div>
        <IntangibleAssetsReport />
      </div>
    </div>
  )
}

