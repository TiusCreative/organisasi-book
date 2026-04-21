"use client"

import { useState } from "react"
import { X, Save, Plus } from "lucide-react"

export default function AddDepreciationAssetModal() {
  const [isOpen, setIsOpen] = useState(false)

  if (!isOpen) return (
    <button 
      onClick={() => setIsOpen(true)}
      className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 shadow-lg transition-all active:scale-95"
    >
      <Plus size={18} /> Aset Baru
    </button>
  )

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-80 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-shrink-0">
          <h3 className="font-bold text-slate-800 text-xl">Tambah Aset Tetap</h3>
          <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
        </div>

        <form className="p-6 space-y-4 flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Nama Aset</label>
              <input 
                name="name" 
                required 
                placeholder="Contoh: Komputer, Mobil" 
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none" 
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Kode Akun</label>
              <input 
                name="code" 
                required 
                placeholder="Contoh: 1501" 
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none" 
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Tanggal Perolehan</label>
            <input 
              name="acquisitionDate" 
              type="date"
              required 
              className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none" 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Harga Perolehan (Rp)</label>
              <input 
                name="acquisitionCost" 
                type="number"
                required 
                placeholder="0" 
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none" 
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Umur Ekonomis (Tahun)</label>
              <input 
                name="usefulLife" 
                type="number"
                required 
                placeholder="5" 
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none" 
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Nilai Sisa (Rp)</label>
            <input 
              name="residualValue" 
              type="number"
              required 
              placeholder="0" 
              className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none" 
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Metode Penyusutan</label>
            <select 
              name="depreciationMethod" 
              required 
              className="w-full p-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">-- Pilih Metode --</option>
              <option value="straight-line">Garis Lurus</option>
              <option value="declining-balance">Saldo Menurun</option>
              <option value="production">Berbasis Produksi</option>
            </select>
          </div>

          <button 
            type="submit" 
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all mt-4"
          >
            <Save size={20} /> Simpan Aset
          </button>
        </form>
      </div>
    </div>
  )
}
