"use client"

import { useState } from "react"
import { createWarehouse, updateWarehouse, deleteWarehouse } from "@/app/actions/warehouse"
import { X, Plus, Edit, Trash2, MapPin, Building2, User, Package } from "lucide-react"
import ImageUpload from "@/components/ui/ImageUpload"

export default function WarehouseManager({ warehouses, organizationId }: any) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<any>(null)
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    type: "MAIN",
    managerId: "",
    status: "ACTIVE",
    notes: "",
    imageUrl: ""
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const data = new FormData()
    Object.entries(formData).forEach(([key, value]) => {
      data.append(key, value)
    })
    
    if (editingWarehouse) {
      data.append("id", editingWarehouse.id)
      await updateWarehouse(data)
    } else {
      await createWarehouse(data)
    }
    
    setIsModalOpen(false)
    setEditingWarehouse(null)
    setFormData({
      name: "",
      location: "",
      type: "MAIN",
      managerId: "",
      status: "ACTIVE",
      notes: "",
      imageUrl: ""
    })
    window.location.reload()
  }

  const handleEdit = (warehouse: any) => {
    setEditingWarehouse(warehouse)
    setFormData({
      name: warehouse.name,
      location: warehouse.location || "",
      type: warehouse.type,
      managerId: warehouse.managerId || "",
      status: warehouse.status,
      notes: warehouse.notes || "",
      imageUrl: warehouse.imageUrl || ""
    })
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm("Yakin ingin menghapus gudang ini?")) {
      await deleteWarehouse(id)
      window.location.reload()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Warehouse Management</h1>
          <p className="text-slate-500">Kelola data gudang perusahaan</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-blue-700 transition"
        >
          <Plus size={20} /> Tambah Gudang
        </button>
      </div>

      {warehouses.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg">
          <Package size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">Belum ada gudang. Klik "Tambah Gudang" untuk menambahkan.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {warehouses.map((warehouse: any) => (
            <div key={warehouse.id} className="bg-white border rounded-lg p-5 hover:shadow-md transition">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-lg text-slate-800">{warehouse.name}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${warehouse.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                      {warehouse.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">{warehouse.code}</span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(warehouse)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(warehouse.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <Building2 size={14} />
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    warehouse.type === 'MAIN' ? 'bg-purple-100 text-purple-700' :
                    warehouse.type === 'BRANCH' ? 'bg-blue-100 text-blue-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {warehouse.type}
                  </span>
                </div>

                {warehouse.location && (
                  <div className="flex items-center gap-2">
                    <MapPin size={14} />
                    <span>{warehouse.location}</span>
                  </div>
                )}

                {warehouse.manager && (
                  <div className="flex items-center gap-2">
                    <User size={14} />
                    <span>{warehouse.manager.name}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-shrink-0">
              <h3 className="font-bold text-slate-800 text-xl">
                {editingWarehouse ? "Edit Gudang" : "Tambah Gudang"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Gudang *</label>
                <input
                  name="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Lokasi</label>
                <input
                  name="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipe Gudang</label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="MAIN">Gudang Utama</option>
                  <option value="BRANCH">Gudang Cabang</option>
                  <option value="TRANSIT">Gudang Transit</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Manager</label>
                <input
                  name="managerId"
                  value={formData.managerId}
                  onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                  placeholder="ID User Manager"
                  className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="ACTIVE">Aktif</option>
                  <option value="INACTIVE">Nonaktif</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Catatan</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Foto Gudang (Opsional)</label>
                <ImageUpload 
                  value={formData.imageUrl} 
                  onChange={(url) => setFormData({ ...formData, imageUrl: url })}
                  folder="catalog"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-all mt-4"
              >
                {editingWarehouse ? "Update Gudang" : "Simpan Gudang"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
