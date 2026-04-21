'use client'

import { useState } from 'react'
import { createOrganization } from '../app/actions/organization'
import { Building2 } from 'lucide-react'

export default function OrganizationCreateForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(formData: FormData) {
    setIsLoading(true)
    setError('')
    try {
      await createOrganization(formData)
      // Page will redirect automatically
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-emerald-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-8 text-white text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <Building2 size={40} />
              </div>
            </div>
            <h1 className="text-2xl font-bold">Buat Organisasi</h1>
            <p className="text-blue-100 mt-2">Mulai mengelola keuangan organisasi Anda</p>
          </div>

          {/* Form */}
          <form action={handleSubmit} className="p-8 space-y-5">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Nama Organisasi *
              </label>
              <input
                type="text"
                name="name"
                required
                placeholder="PT. ABC atau Yayasan XYZ"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Tipe Organisasi *
              </label>
              <select
                name="type"
                required
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Pilih Tipe --</option>
                <option value="PERUSAHAAN">Perusahaan</option>
                <option value="YAYASAN">Yayasan</option>
                <option value="KOPERASI">Koperasi</option>
                <option value="LAINNYA">Lainnya</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Alamat
              </label>
              <input
                type="text"
                name="address"
                placeholder="Jl. Contoh No. 123"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Kota
                </label>
                <input
                  type="text"
                  name="city"
                  placeholder="Jakarta"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Provinsi
                </label>
                <input
                  type="text"
                  name="province"
                  placeholder="DKI Jakarta"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Kode Pos
              </label>
              <input
                type="text"
                name="postalCode"
                placeholder="12345"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Telepon
                </label>
                <input
                  type="tel"
                  name="phone"
                  placeholder="+62 21 1234 5678"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  placeholder="info@organisasi.com"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                NPWP / Tax ID
              </label>
              <input
                type="text"
                name="taxId"
                placeholder="12.345.678.9-012.345"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Nomor Registrasi
              </label>
              <input
                type="text"
                name="registrationNumber"
                placeholder="Nomor Akta Notaris / SK"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Mata Uang
              </label>
              <select
                name="currency"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="IDR">IDR (Rupiah Indonesia)</option>
                <option value="USD">USD (US Dollar)</option>
                <option value="SGD">SGD (Singapore Dollar)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold py-3 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {isLoading ? 'Membuat Organisasi...' : 'Buat Organisasi'}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-600 text-sm mt-6">
          Anda dapat mengubah informasi ini nanti di halaman Pengaturan
        </p>
      </div>
    </div>
  )
}
