"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff } from "lucide-react"
import { registerOrganizationOwner } from "../../app/actions/auth"

export default function RegisterForm() {
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")

    const formData = new FormData(event.currentTarget)

    startTransition(async () => {
      const result = await registerOrganizationOwner(formData)
      if (!result.success) {
        setError(result.error || "Pendaftaran gagal.")
        return
      }

      router.push(result.redirectTo || "/")
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-bold text-slate-700 mb-1">Nama Owner</label>
        <input
          type="text"
          name="ownerName"
          required
          className="w-full rounded-xl border border-slate-200 px-4 py-3"
          placeholder="Nama penanggung jawab"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-700 mb-1">Nama Organisasi</label>
        <input
          type="text"
          name="organizationName"
          required
          className="w-full rounded-xl border border-slate-200 px-4 py-3"
          placeholder="PT / Yayasan / Organisasi"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
          <input
            type="email"
            name="email"
            required
            className="w-full rounded-xl border border-slate-200 px-4 py-3"
            placeholder="owner@organisasi.com"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              minLength={8}
              required
              className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12"
              placeholder="Minimal 8 karakter"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">Tipe Organisasi</label>
          <select name="type" className="w-full rounded-xl border border-slate-200 px-4 py-3">
            <option value="PERUSAHAAN">Perusahaan</option>
            <option value="YAYASAN">Yayasan</option>
            <option value="KOPERASI">Koperasi</option>
            <option value="LAINNYA">Lainnya</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">Paket</label>
          <select name="plan" className="w-full rounded-xl border border-slate-200 px-4 py-3">
            <option value="ANNUAL">Tahunan 1 Tahun</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-700 mb-1">Alamat</label>
        <input
          type="text"
          name="address"
          className="w-full rounded-xl border border-slate-200 px-4 py-3"
          placeholder="Jl. Contoh No. 123"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <input
          type="text"
          name="city"
          className="w-full rounded-xl border border-slate-200 px-4 py-3"
          placeholder="Kota"
        />
        <input
          type="text"
          name="province"
          className="w-full rounded-xl border border-slate-200 px-4 py-3"
          placeholder="Provinsi"
        />
        <input
          type="text"
          name="postalCode"
          className="w-full rounded-xl border border-slate-200 px-4 py-3"
          placeholder="Kode Pos"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-700 mb-1">Telepon</label>
        <input
          type="tel"
          name="phone"
          className="w-full rounded-xl border border-slate-200 px-4 py-3"
          placeholder="+62..."
        />
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
        Langganan aktif selama 1 tahun sejak organisasi dibuat. Sebelum habis, admin organisasi bisa memperpanjang dari halaman `Berlangganan`.
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
      >
        {isPending ? "Mendaftarkan..." : "Daftar & Buat Organisasi"}
      </button>
    </form>
  )
}
