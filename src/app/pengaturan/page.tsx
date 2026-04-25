import { Settings, Download, DollarSign, ArrowLeft, FileText } from "lucide-react"
import OrganizationSettingsForm from "../../components/settings/OrganizationSettingsForm"
import DatabaseExportImport from "../../components/settings/DatabaseExportImport"
import DeleteOrganizationButton from "../../components/settings/DeleteOrganizationButton"
import PeriodLockManager from "../../components/settings/PeriodLockManager"
import CurrencyManagement from "../../components/settings/CurrencyManagement"
import DocumentTemplateSettings from "../../components/settings/DocumentTemplateSettings"
import { requireCurrentOrganization, requireModuleAccess, requireOrganizationAdmin } from "../../lib/auth"
import Link from "next/link"

export default async function PengaturanPage() {
  await requireModuleAccess("organizationSettings", { allowExpired: true })
  await requireOrganizationAdmin({ allowExpired: true })
  const { organization: activeOrg } = await requireCurrentOrganization({ allowExpired: true })

  if (!activeOrg) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-0">
        <h1 className="text-2xl font-bold text-slate-800">Pengaturan</h1>
        <p className="text-slate-500 mt-2">Belum ada organisasi. Silakan buat organisasi terlebih dahulu.</p>
      </div>
    )
  }

  return (
    <div className="max-w-full lg:max-w-6xl mx-auto px-4 sm:px-0 space-y-6">
      <div className="mb-6">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors">
          <ArrowLeft size={20} />
          <span>Kembali ke Dashboard</span>
        </Link>
      </div>
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">Pengaturan</h1>
        <p className="text-slate-500 text-sm mt-1">Kelola konfigurasi organisasi dan ekspor/impor data</p>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 text-sm text-blue-700">
        Langganan organisasi berlaku sampai {activeOrg.subscriptionEndsAt ? new Date(activeOrg.subscriptionEndsAt).toLocaleDateString("id-ID") : "-"}.
        {" "}
        <Link href="/berlangganan" className="font-bold underline underline-offset-2">
          Buka halaman perpanjangan
        </Link>
      </div>

      {/* Organization Details */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-3 flex-col sm:flex-row">
          <Settings size={24} className="text-blue-600" />
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800">Informasi Organisasi</h2>
            <p className="text-xs sm:text-sm text-slate-500">Edit detail organisasi Anda</p>
          </div>
        </div>
        <OrganizationSettingsForm organization={activeOrg} />
      </div>

      {/* Period Lock Management */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <PeriodLockManager />
      </div>

      {/* Currency Management */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-3 flex-col sm:flex-row">
          <DollarSign size={24} className="text-emerald-600" />
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800">Multi-Currency</h2>
            <p className="text-xs sm:text-sm text-slate-500">Kelola mata uang dan kurs</p>
          </div>
        </div>
        <CurrencyManagement organizationId={activeOrg.id} />
      </div>

      {/* Document Template Settings - Temporarily disabled due to React error */}
      {/*
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-3 flex-col sm:flex-row">
          <FileText size={24} className="text-blue-600" />
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800">Template Dokumen</h2>
            <p className="text-xs sm:text-sm text-slate-500">Desain layout cetak untuk Invoice, PO, DO, dan lainnya</p>
          </div>
        </div>
        <DocumentTemplateSettings />
      </div>
      */}

      {/* 
      {/* Export/Import */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-3 flex-col sm:flex-row">
          <Download size={24} className="text-emerald-600" />
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800">Ekspor & Impor Data</h2>
            <p className="text-xs sm:text-sm text-slate-500">Backup dan restore data organisasi</p>
          </div>
        </div>
        <DatabaseExportImport organizationId={activeOrg.id} orgName={activeOrg.name} />
      </div>

      <DeleteOrganizationButton organizationId={activeOrg.id} organizationName={activeOrg.name} />
    </div>
  )
}
