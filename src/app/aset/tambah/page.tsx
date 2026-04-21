import { ArrowLeft, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import TambahAsetForm from '../../../components/forms/TambahAsetForm'
import { requireModuleAccess } from '../../../lib/auth'

export default async function TambahAsetPage() {
  const { organization: activeOrg } = await requireModuleAccess("assets")

  if (!activeOrg) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/aset"
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-slate-600" />
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">Tambah Aset Baru</h1>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle size={24} className="mx-auto text-red-600 mb-2" />
          <p className="text-red-800 font-bold">Organisasi tidak ditemukan</p>
          <p className="text-red-600 text-sm mt-1">Silakan buat organisasi terlebih dahulu</p>
        </div>
      </div>
    )
  }

  return <TambahAsetForm organizationId={activeOrg.id} />
}
