"use client"

import { useState } from "react"
import { Save } from "lucide-react"
import { updateOrganization } from "../../app/actions/organization"

const ORGANIZATION_TYPES = [
  { value: 'YAYASAN', label: 'Yayasan' },
  { value: 'PERUSAHAAN', label: 'Perusahaan' },
  { value: 'KOPERASI', label: 'Koperasi' },
  { value: 'PEMERINTAH', label: 'Pemerintah' },
  { value: 'LAINNYA', label: 'Lainnya' }
]

const CURRENCIES = [
  { value: 'IDR', label: 'Rupiah (IDR)' },
  { value: 'USD', label: 'Dolar Amerika (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'SGD', label: 'Dolar Singapura (SGD)' }
]

const MONTHS = [
  { value: '1', label: 'Januari' },
  { value: '2', label: 'Februari' },
  { value: '3', label: 'Maret' },
  { value: '4', label: 'April' },
  { value: '5', label: 'Mei' },
  { value: '6', label: 'Juni' },
  { value: '7', label: 'Juli' },
  { value: '8', label: 'Agustus' },
  { value: '9', label: 'September' },
  { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' },
  { value: '12', label: 'Desember' }
]

interface OrganizationSettingsFormProps {
  organization: any
}

export default function OrganizationSettingsForm({ organization }: OrganizationSettingsFormProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [organizationType, setOrganizationType] = useState(organization.type || "YAYASAN")
  const [logoUrl, setLogoUrl] = useState(organization.logo || "")

  const organizationLabel = organizationType === "YAYASAN" ? "Nama Yayasan" : "Nama Perusahaan / Organisasi"

  const handleSubmit = async (formData: FormData) => {
    setIsSaving(true)
    setMessage("")
    try {
      const result = await updateOrganization(formData)
      if (result.success) {
        setMessage("Pengaturan berhasil disimpan!")
        setTimeout(() => setMessage(""), 3000)
      }
    } catch (error) {
      setMessage("Gagal menyimpan pengaturan")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form action={handleSubmit} className="p-6 space-y-6">
      <input type="hidden" name="id" value={organization.id} />

      {message && (
        <div className={`p-4 rounded-lg ${message.includes('berhasil') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
          {message}
        </div>
      )}

      {/* Basic Information */}
      <div>
        <h3 className="font-bold text-slate-800 mb-4">Informasi Dasar</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">{organizationLabel}</label>
            <input 
              name="name" 
              required 
              defaultValue={organization.name}
              placeholder={organizationType === "YAYASAN" ? "Contoh: Yayasan Harapan Bangsa" : "Contoh: PT Nusantara Jaya"}
              className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none" 
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Tipe Organisasi</label>
            <select 
              name="type" 
              required 
              defaultValue={organization.type}
              onChange={(event) => setOrganizationType(event.target.value)}
              className="w-full p-3 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {ORGANIZATION_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)] gap-4 mt-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Logo / URL Logo</label>
            <input
              name="logo"
              type="url"
              defaultValue={organization.logo || ""}
              onChange={(event) => setLogoUrl(event.target.value)}
              placeholder="https://domain.com/logo.png"
              className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <p className="text-xs text-slate-500 mt-2">Gunakan URL gambar logo agar identitas organisasi tampil konsisten di laporan dan halaman aplikasi.</p>
          </div>

          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 flex items-center justify-center min-h-32">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={organization.name} className="max-h-20 w-auto object-contain" />
            ) : (
              <div className="text-center text-sm text-slate-500">
                <p className="font-semibold text-slate-700">Preview Logo</p>
                <p className="mt-1">Belum ada logo yang tersimpan</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Address Information */}
      <div>
        <h3 className="font-bold text-slate-800 mb-4">Alamat</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Alamat Lengkap</label>
            <textarea 
              name="address" 
              defaultValue={organization.address || ''}
              placeholder="Jalan, nomor, desa/kelurahan"
              rows={2}
              className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none" 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Kota</label>
              <input 
                name="city" 
                defaultValue={organization.city || ''}
                placeholder="Contoh: Jakarta"
                className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none" 
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Provinsi</label>
              <input 
                name="province" 
                defaultValue={organization.province || ''}
                placeholder="Contoh: DKI Jakarta"
                className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none" 
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Kode Pos</label>
              <input 
                name="postalCode" 
                defaultValue={organization.postalCode || ''}
                placeholder="Contoh: 12140"
                className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none" 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div>
        <h3 className="font-bold text-slate-800 mb-4">Kontak</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Nomor Telepon</label>
            <input 
              name="phone" 
              type="tel"
              defaultValue={organization.phone || ''}
              placeholder="Contoh: 021-1234567"
              className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none" 
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
            <input 
              name="email" 
              type="email"
              defaultValue={organization.email || ''}
              placeholder="Contoh: info@organisasi.com"
              className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none" 
            />
          </div>
        </div>
      </div>

      {/* Legal Information */}
      <div>
        <h3 className="font-bold text-slate-800 mb-4">Informasi Legal</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">NPWP/Nomor Pajak</label>
            <input 
              name="taxId" 
              defaultValue={organization.taxId || ''}
              placeholder="Contoh: 12.345.678.9-123.456"
              className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none" 
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Nomor Pendaftaran</label>
            <input 
              name="registrationNumber" 
              defaultValue={organization.registrationNumber || ''}
              placeholder="Nomor akta notaris / SK Kemenkumham"
              className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none" 
            />
          </div>
        </div>
      </div>

      {/* Financial Settings */}
      <div>
        <h3 className="font-bold text-slate-800 mb-4">Pengaturan Keuangan</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Mata Uang</label>
            <select 
              name="currency" 
              defaultValue={organization.currency || 'IDR'}
              className="w-full p-3 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {CURRENCIES.map(curr => (
                <option key={curr.value} value={curr.value}>{curr.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Awal Tahun Fiskal</label>
            <select 
              name="fiscalYearStart" 
              defaultValue={organization.fiscalYearStart || '1'}
              className="w-full p-3 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {MONTHS.map(month => (
                <option key={month.value} value={month.value}>{month.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
        <button 
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold disabled:opacity-50"
        >
          <Save size={20} /> {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </button>
      </div>
    </form>
  )
}
