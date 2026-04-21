"use client"

import { useState } from "react"
import { Landmark, Save, X } from "lucide-react"
import { inkasoInvestment } from "../../app/actions/investment"

export default function InkasoInvestmentModal({
  investment,
  bankAccounts,
  adjustmentAccounts,
}: {
  investment: any
  bankAccounts: any[]
  adjustmentAccounts: any[]
}) {
  const [isOpen, setIsOpen] = useState(false)

  if (investment.inkasoTransactionId) {
    return <span className="text-xs font-bold text-emerald-600">Sudah Diinkaso</span>
  }

  if (!isOpen) {
    return (
        <button onClick={() => setIsOpen(true)} className="text-sm font-medium text-emerald-600 hover:underline">
        <span className="inline-flex items-center gap-1"><Landmark size={14} /> Inkaso</span>
      </button>
    )
  }

  const defaultDate = new Date().toISOString().slice(0, 10)

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-6">
          <h3 className="text-xl font-bold text-slate-800">Inkaso Investasi</h3>
          <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
            <X size={22} />
          </button>
        </div>

        <form
          action={async (formData) => {
            await inkasoInvestment(formData)
            setIsOpen(false)
          }}
          className="space-y-4 p-6"
        >
          <input type="hidden" name="investmentId" value={investment.id} />

          <div className="rounded-xl bg-slate-50 p-4">
            <p className="font-bold text-slate-800">{investment.name}</p>
            <p className="mt-1 text-sm text-slate-500">{investment.institution}</p>
            <p className="mt-3 text-sm text-slate-600">Nilai Buku Saat Ini: <span className="font-bold text-slate-800">Rp {Number(investment.currentValue || investment.purchaseAmount).toLocaleString("id-ID")}</span></p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700">Rekening Tujuan Inkaso</label>
            <select name="settlementBankAccountId" required className="w-full rounded-xl border border-slate-200 bg-white p-3 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">-- Pilih Rekening --</option>
              {bankAccounts.map((bank) => (
                <option key={bank.id} value={bank.id}>{bank.bankName} - {bank.accountNumber}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Tanggal Inkaso</label>
              <input name="settlementDate" type="date" required defaultValue={defaultDate} className="w-full rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Nominal Inkaso</label>
              <input name="settlementAmount" type="number" step="0.01" required defaultValue={investment.currentValue || investment.purchaseAmount} className="w-full rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700">Akun Penyesuaian Laba/Rugi</label>
            <select name="adjustmentAccountId" className="w-full rounded-xl border border-slate-200 bg-white p-3 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">-- Pilih jika nominal berbeda dari nilai buku --</option>
              {adjustmentAccounts.map((account) => (
                <option key={account.id} value={account.id}>{account.code} - {account.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700">Catatan</label>
            <textarea name="notes" rows={3} className="w-full resize-none rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-bold text-white hover:bg-emerald-700">
            <Save size={18} /> Posting Inkaso
          </button>
        </form>
      </div>
    </div>
  )
}
