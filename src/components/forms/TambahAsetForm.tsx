'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createAsset } from '../../app/actions/asset'
import { ArrowLeft, Save, AlertCircle } from 'lucide-react'
import Link from 'next/link'

interface TambahAsetFormProps {
  organizationId: string
}

const ASSET_CATEGORIES = [
  { value: 'Tanah', label: 'Tanah' },
  { value: 'Bangunan', label: 'Bangunan' },
  { value: 'Kendaraan', label: 'Kendaraan' },
  { value: 'Mesin', label: 'Mesin' },
  { value: 'Peralatan', label: 'Peralatan' },
  { value: 'Furniture', label: 'Furniture dan Perlengkapan' },
  { value: 'Elektronik', label: 'Elektronik dan Komputer' },
  { value: 'Aset Tak Berwujud', label: 'Aset Tak Berwujud (Software/Lisensi/Goodwill)' },
  { value: 'Lainnya', label: 'Lainnya' }
]

const DEPRECIATION_METHODS = [
  { value: 'straight-line', label: 'Garis Lurus' },
  { value: 'declining-balance', label: 'Saldo Menurun' },
  { value: 'production', label: 'Jam Produksi' }
]

export default function TambahAsetForm({ organizationId }: TambahAsetFormProps) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const formData = new FormData(e.currentTarget)
      formData.set('organizationId', organizationId)
      
      const result = await createAsset(formData)
      
      if (result.success) {
        router.push('/aset')
      } else {
        setError(result.error || 'Gagal menambah aset')
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/aset"
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} className="text-slate-600" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Tambah Aset Baru</h1>
          <p className="text-slate-500 mt-1">Masukkan data lengkap aset tetap</p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Form Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 md:p-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Section 1: Identitas Aset */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800 pb-4 border-b border-slate-200">
              Identitas Aset
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Nama Aset <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="Contoh: Gedung Kantor Pusat, Komputer Dell"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Kode Aset <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="code"
                  required
                  placeholder="Contoh: ASSET-001"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Deskripsi Aset
              </label>
              <textarea
                name="description"
                placeholder="Masukkan deskripsi lengkap aset"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Kategori Aset <span className="text-red-500">*</span>
              </label>
              <select
                name="category"
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">-- Pilih Kategori --</option>
                {ASSET_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 2: Data Perolehan */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800 pb-4 border-b border-slate-200">
              Data Perolehan
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Tanggal Perolehan <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="purchaseDate"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Harga Perolehan (Rp) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="purchasePrice"
                  required
                  placeholder="0"
                  min="0"
                  step="1000"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Nilai Sisa / Residu (Rp) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="residualValue"
                  required
                  placeholder="0"
                  min="0"
                  step="1000"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Masa Manfaat (Tahun) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="usefulLife"
                  required
                  placeholder="5"
                  min="1"
                  max="100"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Metode Penyusutan */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800 pb-4 border-b border-slate-200">
              Metode Penyusutan
            </h2>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Metode Penyusutan <span className="text-red-500">*</span>
              </label>
              <select
                name="depreciationMethod"
                defaultValue="straight-line"
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">-- Pilih Metode --</option>
                {DEPRECIATION_METHODS.map(method => (
                  <option key={method.value} value={method.value}>{method.label}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-2">
                Garis Lurus: Penyusutan sama setiap tahun | Saldo Menurun: Penyusutan menurun setiap tahun
              </p>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-6 border-t border-slate-200">
            <Link
              href="/aset"
              className="flex-1 px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition-colors text-center"
            >
              Batal
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Save size={20} />
              {loading ? 'Menyimpan...' : 'Simpan Aset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
