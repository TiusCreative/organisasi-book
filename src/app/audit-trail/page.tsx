import { Shield, Clock } from "lucide-react"
import { requireCurrentOrganization, requireModuleAccess, requireOrganizationAdmin } from "../../lib/auth"
import AuditTrailViewer from "../../components/audit/AuditTrailViewer"

export default async function AuditTrailPage() {
  await requireModuleAccess("auditTrail", { allowExpired: true })
  await requireOrganizationAdmin({ allowExpired: true })
  const { organization: activeOrg } = await requireCurrentOrganization({ allowExpired: true })

  if (!activeOrg) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-0">
        <h1 className="text-2xl font-bold text-slate-800">Audit Trail</h1>
        <p className="text-slate-500 mt-2">Belum ada organisasi. Silakan buat organisasi terlebih dahulu.</p>
      </div>
    )
  }

  return (
    <div className="max-w-full lg:max-w-7xl mx-auto px-4 sm:px-0 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">Audit Trail</h1>
        <p className="text-slate-500 text-sm mt-1">Riwayat semua perubahan data dalam sistem</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-3 flex-col sm:flex-row">
          <Shield size={24} className="text-purple-600" />
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800">Log Aktivitas</h2>
            <p className="text-xs sm:text-sm text-slate-500">Lihat semua perubahan yang dilakukan oleh pengguna</p>
          </div>
        </div>
        <AuditTrailViewer />
      </div>
    </div>
  )
}
