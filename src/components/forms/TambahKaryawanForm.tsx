'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createEmployee } from '../../app/actions/payroll'
import { ArrowLeft, Save, AlertCircle } from 'lucide-react'
import Link from 'next/link'

interface TambahKaryawanFormProps {
  organizationId: string
}

export default function TambahKaryawanForm({ organizationId }: TambahKaryawanFormProps) {
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
      
      const result = await createEmployee(formData)
      
      if (result.success) {
        router.push('/gaji')
      } else {
        setError(result.error || 'Gagal menambah karyawan')
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
          href="/gaji"
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} className="text-slate-600" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Tambah Karyawan Baru</h1>
          <p className="text-slate-500 mt-1">Masukkan data lengkap karyawan</p>
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
          {/* Section 1: Identitas Dasar */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800 pb-4 border-b border-slate-200">
              Identitas Dasar
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Nama Lengkap <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="Masukkan nama lengkap"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  No. Induk Karyawan (NIK)
                </label>
                <input
                  type="text"
                  name="nik"
                  placeholder="Contoh: EMP-001"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Nomor Pegawai
                </label>
                <input
                  type="text"
                  name="employeeNumber"
                  placeholder="Nomor pegawai perusahaan"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  placeholder="nama@email.com"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  No. Telepon
                </label>
                <input
                  type="tel"
                  name="phone"
                  placeholder="08xx-xxxx-xxxx"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  NPWP
                </label>
                <input
                  type="text"
                  name="taxFileNumber"
                  placeholder="00.000.000.0-000.000"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Data Pekerjaan */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800 pb-4 border-b border-slate-200">
              Data Pekerjaan
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Jabatan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="position"
                  required
                  placeholder="Contoh: Manager, Staf, dsb"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Departemen
                </label>
                <input
                  type="text"
                  name="department"
                  placeholder="Contoh: IT, Finance, HR"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Tanggal Bergabung <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="joinDate"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Status Pajak
                </label>
                <select
                  name="taxStatus"
                  defaultValue="TK"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="TK">TK (Tidak Kawin)</option>
                  <option value="K">K (Kawin)</option>
                  <option value="K1">K1 (Kawin + 1 Anak)</option>
                  <option value="K2">K2 (Kawin + 2 Anak)</option>
                  <option value="K3">K3 (Kawin + 3 Anak)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Data Gaji */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800 pb-4 border-b border-slate-200">
              Data Gaji
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Gaji Pokok (Rp) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="baseSalary"
                  required
                  placeholder="0"
                  min="0"
                  step="1000"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Nama Bank
                </label>
                <input
                  type="text"
                  name="bankName"
                  placeholder="Contoh: BCA, Mandiri, BSI"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Nomor Rekening Bank
              </label>
              <input
                type="text"
                name="bankAccount"
                placeholder="Nomor rekening untuk pencairan gaji"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Section 4: Data Asuransi */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800 pb-4 border-b border-slate-200">
              Data Asuransi (Opsional)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  BPJS Kesehatan
                </label>
                <input
                  type="text"
                  name="bpjsKesehatanNumber"
                  placeholder="Nomor BPJS Kesehatan"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  BPJS Ketenagakerjaan
                </label>
                <input
                  type="text"
                  name="bpjsKetenagakerjaan"
                  placeholder="Nomor BPJS Ketenagakerjaan"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-6 border-t border-slate-200">
            <Link
              href="/gaji"
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
              {loading ? 'Menyimpan...' : 'Simpan Karyawan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
