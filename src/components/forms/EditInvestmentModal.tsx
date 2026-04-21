"use client"

import { useState } from "react"
import { Edit2, Save, X } from "lucide-react"
import { updateInvestment } from "../../app/actions/investment"

const INVESTMENT_TYPES = [
  { value: "DEPOSITO", label: "Deposito" },
  { value: "SAHAM", label: "Saham" },
  { value: "INVESTASI_LAINNYA", label: "Investasi Lainnya" },
]

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Aktif" },
  { value: "MATURED", label: "Jatuh Tempo" },
  { value: "LIQUIDATED", label: "Sudah Diinkaso" },
]

export default function EditInvestmentModal({
  investment,
  bankAccounts,
}: {
  investment: any
  bankAccounts: any[]
}) {
  const [isOpen, setIsOpen] = useState(false)

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)} className="text-sm font-medium text-blue-600 hover:underline">
        <span className="inline-flex items-center gap-1"><Edit2 size={14} /> Edit</span>
      </button>
    )
  }

  const formatDate = (value?: string | Date | null) => {
    if (!value) return ""
    return new Date(value).toISOString().slice(0, 10)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-y-auto max-h-[90vh] rounded-2xl bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-6 flex-shrink-0">
          <h3 className="text-xl font-bold text-slate-800">Edit Investasi</h3>
          <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
            <X size={22} />
          </button>
        </div>

        <form
          action={async (formData) => {
            await updateInvestment(formData)
            setIsOpen(false)
          }}
          className="space-y-4 p-6 flex-1 overflow-y-auto"
        >
          <input type="hidden" name="id" value={investment.id} />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Jenis Investasi</label>
              <select name="type" required defaultValue={investment.type} className="w-full rounded-xl border border-slate-200 bg-white p-3 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {INVESTMENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Status</label>
              <select name="status" defaultValue={investment.status} className="w-full rounded-xl border border-slate-200 bg-white p-3 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {STATUS_OPTIONS.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <input name="name" required defaultValue={investment.name} placeholder="Nama investasi" className="w-full rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input name="institution" required defaultValue={investment.institution} placeholder="Institusi" className="w-full rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <input name="referenceNumber" defaultValue={investment.referenceNumber || ""} placeholder="No. referensi" className="w-full rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input name="startDate" type="date" required defaultValue={formatDate(investment.startDate)} className="w-full rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input name="maturityDate" type="date" defaultValue={formatDate(investment.maturityDate)} className="w-full rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <input name="purchaseAmount" type="number" step="0.01" required defaultValue={investment.purchaseAmount} className="w-full rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input name="currentValue" type="number" step="0.01" required defaultValue={investment.currentValue} className="w-full rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input name="expectedReturn" type="number" step="0.01" defaultValue={investment.expectedReturn || 0} className="w-full rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700">Bank Sumber</label>
            <select name="sourceBankAccountId" defaultValue={investment.sourceBankAccountId || ""} className="w-full rounded-xl border border-slate-200 bg-white p-3 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">-- Pilih Rekening --</option>
              {bankAccounts.map((bank) => (
                <option key={bank.id} value={bank.id}>{bank.bankName} - {bank.accountNumber}</option>
              ))}
            </select>
          </div>

          <textarea name="notes" defaultValue={investment.notes || ""} rows={3} className="w-full resize-none rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />

          <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-bold text-white hover:bg-blue-700">
            <Save size={18} /> Simpan Perubahan
          </button>
        </form>
      </div>
    </div>
  )
}
