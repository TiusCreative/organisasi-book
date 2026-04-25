"use client"

import { useState } from "react"
import { Save, Building, MapPin, Image as ImageIcon, Phone } from "lucide-react"

type CompanySettings = {
  companyName: string
  address: string
  phone: string
  logoUrl: string
}

export default function SettingsTemplate({ initialSettings }: { initialSettings?: CompanySettings }) {
  const [formData, setFormData] = useState<CompanySettings>({
    companyName: initialSettings?.companyName || "",
    address: initialSettings?.address || "",
    phone: initialSettings?.phone || "",
    logoUrl: initialSettings?.logoUrl || "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    // Panggil Server Action Anda di sini, contoh: await updateCompanySettings(formData)
    setTimeout(() => {
      alert("Pengaturan Template & Perusahaan berhasil disimpan!")
      setIsSubmitting(false)
    }, 800)
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">Identitas Cetak Perusahaan</h2>
          <p className="text-sm text-slate-500">Informasi ini akan ditampilkan sebagai KOP SURAT pada Invoice, Purchase Order, dan Surat Jalan (DO).</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
              <Building size={16} className="text-blue-600" /> Nama Perusahaan Lengkap
            </label>
            <input 
              required
              value={formData.companyName} 
              onChange={e => setFormData({...formData, companyName: e.target.value})}
              placeholder="Contoh: PT Organisasi Book Sukses"
              className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
            />
          </div>
          
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
              <MapPin size={16} className="text-blue-600" /> Alamat Perusahaan
            </label>
            <textarea 
              required
              value={formData.address} 
              onChange={e => setFormData({...formData, address: e.target.value})}
              placeholder="Alamat lengkap beserta kode pos..."
              rows={3}
              className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                <Phone size={16} className="text-blue-600" /> Telepon / Email Kontak
              </label>
              <input 
                value={formData.phone} 
                onChange={e => setFormData({...formData, phone: e.target.value})}
                placeholder="Contoh: 021-1234567 / info@perusahaan.com"
                className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                <ImageIcon size={16} className="text-blue-600" /> URL Logo Perusahaan
              </label>
              <input 
                value={formData.logoUrl} 
                onChange={e => setFormData({...formData, logoUrl: e.target.value})}
                placeholder="https://domain.com/logo.png"
                className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
              />
              {formData.logoUrl && (
                <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg w-fit">
                  <p className="text-xs text-slate-500 mb-1">Pratinjau Logo:</p>
                  <img src={formData.logoUrl} alt="Logo Preview" className="h-10 object-contain" />
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 bg-blue-600 text-white font-bold py-2.5 px-6 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              <Save size={18} /> {isSubmitting ? "Menyimpan..." : "Simpan Pengaturan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}