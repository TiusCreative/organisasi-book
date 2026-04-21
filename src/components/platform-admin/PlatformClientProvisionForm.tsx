"use client"

import { useState, useTransition } from "react"
import { createPlatformClientTenant } from "../../app/actions/platform-admin"

const defaultState = {
  ownerName: "",
  organizationName: "",
  email: "",
  password: "",
  type: "PERUSAHAAN",
  plan: "ANNUAL",
  years: "1",
  subscriptionStatus: "ACTIVE",
  address: "",
  city: "",
  province: "",
  postalCode: "",
  phone: "",
}

export default function PlatformClientProvisionForm() {
  const [form, setForm] = useState(defaultState)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setMessage("")

    startTransition(async () => {
      const formData = new FormData()
      Object.entries(form).forEach(([key, value]) => formData.set(key, value))

      const result = await createPlatformClientTenant(formData)
      if (!result.success) {
        setError(result.error || "Gagal membuat owner dan organisasi client.")
        return
      }

      setMessage("Owner dan organisasi client berhasil dibuat.")
      setForm(defaultState)
      window.location.reload()
    })
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-slate-800">Buat Client Baru</h2>
        <p className="mt-1 text-sm text-slate-500">
          Flow internal ini membuat owner client dan organisasi dalam satu langkah. Pembuatan organisasi tanpa owner tidak dipakai lagi.
        </p>
      </div>

      {(error || message) && (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {error || message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700">Nama Owner</label>
            <input
              value={form.ownerName}
              onChange={(event) => setForm((current) => ({ ...current, ownerName: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-4 py-3"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700">Nama Organisasi</label>
            <input
              value={form.organizationName}
              onChange={(event) => setForm((current) => ({ ...current, organizationName: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-4 py-3"
              required
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700">Email Owner</label>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-4 py-3"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700">Password Awal</label>
            <input
              type="password"
              minLength={8}
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-4 py-3"
              required
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700">Tipe</label>
            <select
              value={form.type}
              onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-4 py-3"
            >
              <option value="PERUSAHAAN">Perusahaan</option>
              <option value="YAYASAN">Yayasan</option>
              <option value="KOPERASI">Koperasi</option>
              <option value="LAINNYA">Lainnya</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700">Paket</label>
            <select
              value={form.plan}
              onChange={(event) => setForm((current) => ({ ...current, plan: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-4 py-3"
            >
              <option value="ANNUAL">Tahunan</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700">Masa Aktif</label>
            <input
              type="number"
              min="1"
              value={form.years}
              onChange={(event) => setForm((current) => ({ ...current, years: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-4 py-3"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700">Status Awal</label>
            <select
              value={form.subscriptionStatus}
              onChange={(event) => setForm((current) => ({ ...current, subscriptionStatus: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-4 py-3"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="PENDING">PENDING</option>
              <option value="SUSPENDED">SUSPENDED</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-bold text-slate-700">Alamat</label>
          <input
            value={form.address}
            onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-4 py-3"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <input
            value={form.city}
            onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-4 py-3"
            placeholder="Kota"
          />
          <input
            value={form.province}
            onChange={(event) => setForm((current) => ({ ...current, province: event.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-4 py-3"
            placeholder="Provinsi"
          />
          <input
            value={form.postalCode}
            onChange={(event) => setForm((current) => ({ ...current, postalCode: event.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-4 py-3"
            placeholder="Kode Pos"
          />
          <input
            value={form.phone}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-4 py-3"
            placeholder="Telepon"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {isPending ? "Membuat..." : "Buat Owner + Organisasi"}
          </button>
        </div>
      </form>
    </div>
  )
}
