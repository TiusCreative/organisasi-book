"use client"

import { useState } from "react"
import { Save, X } from "lucide-react"
import { createInvestment } from "../../app/actions/investment"

const INVESTMENT_TYPES = [
  { value: "DEPOSITO", label: "Deposito" },
  { value: "SAHAM", label: "Saham" },
  { value: "INVESTASI_LAINNYA", label: "Investasi Lainnya" },
]

export default function InvestmentModal({
  organizationId,
  bankAccounts,
}: {
  organizationId: string
  bankAccounts: any[]
}) {
  const [isOpen, setIsOpen] = useState(false)

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
      >
        + Tambah Investasi
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-y-auto max-h-[90vh] rounded-2xl bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-6 flex-shrink-0">
          <h3 className="text-xl font-bold text-slate-800">Tambah Investasi</h3>
          <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
            <X size={22} />
          </button>
        </div>

        <form
          action={async (formData) => {
            await createInvestment(formData)
            setIsOpen(false)
          }}
          className="space-y-4 p-6 flex-1 overflow-y-auto"
        >
          <input type="hidden" name="organizationId" value={organizationId} />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Jenis Investasi</label>
              <select name="type" required className="w-full rounded-xl border border-slate-200 bg-white p-3 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {INVESTMENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Nama Produk</label>
              <input name="name" required placeholder="Contoh: Deposito 6 Bulan" className="w-full rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Institusi</label>
              <input name="institution" required placeholder="Contoh: BCA / Mandiri Sekuritas" className="w-full rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">No. Referensi</label>
              <input name="referenceNumber" placeholder="Nomor bilyet / SID / kontrak" className="w-full rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Tanggal Mulai</label>
              <input name="startDate" type="date" required className="w-full rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Jatuh Tempo</label>
              <input name="maturityDate" type="date" className="w-full rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Bank Sumber</label>
              <select name="sourceBankAccountId" className="w-full rounded-xl border border-slate-200 bg-white p-3 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">-- Pilih Rekening --</option>
                {bankAccounts.map((bank) => (
                  <option key={bank.id} value={bank.id}>{bank.bankName} - {bank.accountNumber}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Nilai Perolehan</label>
              <input name="purchaseAmount" type="number" step="0.01" required className="w-full rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Nilai Buku Saat Ini</label>
              <input name="currentValue" type="number" step="0.01" className="w-full rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Estimasi Hasil</label>
              <input name="expectedReturn" type="number" step="0.01" defaultValue="0" className="w-full rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700">Catatan</label>
            <textarea name="notes" rows={3} className="w-full resize-none rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-bold text-white hover:bg-blue-700">
            <Save size={18} /> Simpan Investasi
          </button>
        </form>
      </div>
    </div>
  )
}
