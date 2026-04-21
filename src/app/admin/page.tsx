import Link from "next/link"
import { Users, Settings } from "lucide-react"
import { requireModuleAccess, requireOrganizationAdmin } from "../../lib/auth"

export default async function AdminPage() {
  await requireModuleAccess("organizationAdmin", { allowExpired: true })
  await requireOrganizationAdmin({ allowExpired: true })

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-0 py-12">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-slate-800">Administrasi Organisasi</h1>
          <p className="text-slate-500 mt-2">Kelola user tim, langganan, dan konfigurasi organisasi</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href="/admin/users"
            className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all p-8 group"
          >
            <div className="flex items-start gap-4">
              <div className="p-4 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors">
                <Users size={32} className="text-blue-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                  Manajemen User Tim
                </h2>
                <p className="text-slate-500 mt-2">
                  Tambah user baru untuk organisasi Anda dan atur hak aksesnya
                </p>
              </div>
            </div>
          </Link>

          <Link
            href="/pengaturan"
            className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all p-8 group"
          >
            <div className="flex items-start gap-4">
              <div className="p-4 bg-emerald-50 rounded-xl group-hover:bg-emerald-100 transition-colors">
                <Settings size={32} className="text-emerald-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-slate-800 group-hover:text-emerald-600 transition-colors">
                  Pengaturan Organisasi
                </h2>
                <p className="text-slate-500 mt-2">
                  Konfigurasi detail organisasi, langganan, dan ekspor/impor data
                </p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
