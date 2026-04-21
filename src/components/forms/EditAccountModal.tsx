"use client"

import { useState } from "react"
import { X, Save, Edit2 } from "lucide-react"
import { updateChartOfAccount } from "../../app/actions/account"

const ACCOUNT_TYPES = [
  { value: 'Asset', label: 'Asset (Aset)' },
  { value: 'Liability', label: 'Liability (Kewajiban)' },
  { value: 'Equity', label: 'Equity (Modal)' },
  { value: 'Revenue', label: 'Revenue (Pendapatan)' },
  { value: 'Expense', label: 'Expense (Biaya)' }
]

interface EditAccountModalProps {
  account: any
  categories: any[]
}

export default function EditAccountModal({ account, categories }: EditAccountModalProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (!isOpen) return (
    <button 
      onClick={() => setIsOpen(true)}
      className="text-blue-600 hover:underline text-sm font-medium"
    >
      Edit
    </button>
  )

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-80 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-shrink-0">
          <h3 className="font-bold text-slate-800 text-xl">Edit Akun</h3>
          <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
        </div>

        <form action={async (formData) => {
          await updateChartOfAccount(formData);
          setIsOpen(false);
        }} className="p-6 space-y-4 flex-1 overflow-y-auto">
          <input type="hidden" name="id" value={account.id} />
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Kode Akun</label>
            <input 
              name="code" 
              required 
              defaultValue={account.code}
              placeholder="Contoh: 1001, 2001, 3001" 
              className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none" 
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Nama Akun</label>
            <input 
              name="name" 
              required 
              defaultValue={account.name}
              placeholder="Contoh: Kas, Bank BCA, Gaji Karyawan" 
              className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none" 
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Tipe Akun</label>
            <select 
              name="type" 
              required 
              defaultValue={account.type}
              className="w-full p-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">-- Pilih Tipe --</option>
              {ACCOUNT_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Kategori (Opsional)</label>
            <select 
              name="categoryId" 
              defaultValue={account.categoryId || ''}
              className="w-full p-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">-- Pilih Kategori --</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <button 
            type="submit" 
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all mt-4"
          >
            <Save size={18} /> Simpan Perubahan
          </button>
        </form>
      </div>
    </div>
  )
}
