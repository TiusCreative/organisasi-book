"use client"

import { useState } from "react"
import { X, Landmark, Save } from "lucide-react"
import { createBankAccount } from "../../app/actions/bank"

export default function BankModal({ orgId }: { orgId: string }) {
  const [isOpen, setIsOpen] = useState(false)

  if (!isOpen) return (
    <button onClick={() => setIsOpen(true)} className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-slate-800 transition shadow-sm text-sm">
      + Tambah Rekening
    </button>
  )

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-shrink-0">
          <h3 className="font-bold text-slate-800 text-xl flex items-center gap-2">
            <Landmark size={20} /> Tambah Bank
          </h3>
          <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
        </div>

        <form action={async (formData) => {
          await createBankAccount(formData);
          setIsOpen(false);
        }} className="p-6 space-y-4 flex-1 overflow-y-auto">
          <input type="hidden" name="orgId" value={orgId} />
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Nama Bank</label>
            <input name="bankName" required placeholder="Contoh: BCA, Mandiri, BSI" className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Nomor Rekening</label>
            <input name="accountNumber" required placeholder="1234567890" className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Atas Nama</label>
            <input name="accountName" required placeholder="Nama pemilik rekening" className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Saldo Awal</label>
            <input
              name="openingBalance"
              type="number"
              inputMode="decimal"
              defaultValue="0"
              placeholder="0"
              className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all mt-4">
            <Save size={20} /> Simpan Rekening
          </button>
        </form>
      </div>
    </div>
  )
}
