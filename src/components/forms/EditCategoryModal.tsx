"use client"

import { useState } from "react"
import { X, Save, Tag } from "lucide-react"
import { updateAccountCategory } from "../../app/actions/category"

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

interface EditCategoryModalProps {
  category: any
}

export default function EditCategoryModal({ category }: EditCategoryModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedColor, setSelectedColor] = useState(category.color)

  if (!isOpen) return (
    <button 
      onClick={() => setIsOpen(true)}
      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-slate-100 transition-colors"
      title="Edit Kategori"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19H4v-3L16.5 3.5z"></path></svg>
    </button>
  )

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-shrink-0">
          <h3 className="font-bold text-slate-800 text-xl flex items-center gap-2">
            <Tag size={20} /> Edit Kategori
          </h3>
          <button 
            onClick={() => setIsOpen(false)} 
            className="text-slate-400 hover:text-slate-600"
          >
            <X size={24} />
          </button>
        </div>

        <form action={async (formData) => {
          await updateAccountCategory(formData);
          setIsOpen(false);
        }} className="p-6 space-y-4 flex-1 overflow-y-auto">
          <input type="hidden" name="id" value={category.id} />
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Nama Kategori</label>
            <input 
              name="name" 
              required 
              defaultValue={category.name}
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
            <Save size={18} /> Simpan Perubahan
          </button>
        </form>
      </div>
    </div>
  )
}
