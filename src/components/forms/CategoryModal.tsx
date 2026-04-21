"use client"

import { useState } from "react"
import { X, Save, Plus, Tag } from "lucide-react"
import { createAccountCategory } from "../../app/actions/category"

const COLOR_OPTIONS = [
  "#3B82F6", // Blue
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#F59E0B", // Amber
  "#10B981", // Emerald
  "#06B6D4", // Cyan
  "#EF4444", // Red
  "#6366F1", // Indigo
]

interface CategoryModalProps {
  orgId: string
}

export default function CategoryModal({ orgId }: CategoryModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedColor, setSelectedColor] = useState(COLOR_OPTIONS[0])

  if (!isOpen) return (
    <button 
      onClick={() => setIsOpen(true)}
      className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 shadow-lg transition-all active:scale-95"
    >
      <Plus size={18} /> Kategori Baru
    </button>
  )

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-shrink-0">
          <h3 className="font-bold text-slate-800 text-xl flex items-center gap-2">
            <Tag size={20} /> Kategori Akun Baru
          </h3>
          <button 
            onClick={() => setIsOpen(false)} 
            className="text-slate-400 hover:text-slate-600"
          >
            <X size={24} />
          </button>
        </div>

        <form action={async (formData) => {
          await createAccountCategory(formData);
          setIsOpen(false);
        }} className="p-6 space-y-4 flex-1 overflow-y-auto">
          <input type="hidden" name="orgId" value={orgId} />
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Nama Kategori</label>
            <input 
              name="name" 
              required 
              placeholder="Contoh: Gaji, Bonus, Uang Makan" 
              className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none" 
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-3">Pilih Warna</label>
            <div className="grid grid-cols-4 gap-3">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    setSelectedColor(color)
                    document.querySelector(`input[name="color"]`)?.setAttribute('value', color)
                  }}
                  className={`w-full h-12 rounded-lg transition-all border-2 ${
                    selectedColor === color 
                      ? 'border-slate-800 scale-105' 
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
            <input type="hidden" name="color" value={selectedColor} />
          </div>

          <button 
            type="submit" 
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all mt-4"
          >
            <Save size={18} /> Buat Kategori
          </button>
        </form>
      </div>
    </div>
  )
}
