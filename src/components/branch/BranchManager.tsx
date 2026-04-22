"use client"

import { useState } from "react"
import { createBranch, updateBranch, deleteBranch } from "@/app/actions/branch"
import { X, Plus, Edit, Trash2, MapPin, Building2, User, Phone, Mail } from "lucide-react"

export default function BranchManager({ branches, organizationId }: any) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingBranch, setEditingBranch] = useState<any>(null)
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    city: "",
    province: "",
    postalCode: "",
    country: "Indonesia",
    phone: "",
    email: "",
    managerId: "",
    warehouseId: "",
    status: "ACTIVE",
    notes: ""
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const data = new FormData()
    Object.entries(formData).forEach(([key, value]) => {
      data.append(key, value)
    })
    
    if (editingBranch) {
      data.append("id", editingBranch.id)
      await updateBranch(data)
    } else {
      await createBranch(data)
    }
    
    setIsModalOpen(false)
    setEditingBranch(null)
    setFormData({
      name: "",
      address: "",
      city: "",
      province: "",
      postalCode: "",
      country: "Indonesia",
      phone: "",
      email: "",
      managerId: "",
      warehouseId: "",
      status: "ACTIVE",
      notes: ""
    })
    window.location.reload()
  }

  const handleEdit = (branch: any) => {
    setEditingBranch(branch)
    setFormData({
      name: branch.name,
      address: branch.address || "",
      city: branch.city || "",
      province: branch.province || "",
      postalCode: branch.postalCode || "",
      country: branch.country || "Indonesia",
      phone: branch.phone || "",
      email: branch.email || "",
      managerId: branch.managerId || "",
      warehouseId: branch.warehouseId || "",
      status: branch.status,
      notes: branch.notes || ""
    })
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm("Yakin ingin menghapus cabang ini?")) {
      await deleteBranch(id)
      window.location.reload()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Branch Management</h1>
          <p className="text-slate-500">Kelola data cabang perusahaan</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-blue-700 transition"
        >
          <Plus size={20} /> Tambah Cabang
        </button>
      </div>

      {branches.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg">
          <Building2 size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">Belum ada cabang. Klik "Tambah Cabang" untuk menambahkan.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {branches.map((branch: any) => (
            <div key={branch.id} className="bg-white border rounded-lg p-5 hover:shadow-md transition">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-lg text-slate-800">{branch.name}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${branch.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                      {branch.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}
                    </span>
                    <span className="text-xs text-slate-400">{branch.code}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm text-slate-600 mb-2">
                    {branch.email && (
                      <div className="flex items-center gap-2">
                        <Mail size={14} /> {branch.email}
                      </div>
                    )}
                    {branch.phone && (
                      <div className="flex items-center gap-2">
                        <Phone size={14} /> {branch.phone}
                      </div>
                    )}
                  </div>

                  {branch.address && (
                    <div className="flex items-start gap-2 text-sm text-slate-600 mb-2">
                      <MapPin size={14} className="mt-0.5" />
                      <span>
                        {branch.address}
                        {branch.city && `, ${branch.city}`}
                        {branch.province && `, ${branch.province}`}
                        {branch.postalCode && ` ${branch.postalCode}`}
                      </span>
                    </div>
                  )}

                  <div className="flex gap-4 text-sm text-slate-600">
                    {branch.manager && (
                      <div className="flex items-center gap-2">
                        <User size={14} />
                        <span>Manager: {branch.manager.name}</span>
                      </div>
                    )}
                    {branch.warehouse && (
                      <div className="flex items-center gap-2">
                        <Building2 size={14} />
                        <span>Gudang: {branch.warehouse.name} ({branch.warehouse.code})</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(branch)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(branch.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-shrink-0">
              <h3 className="font-bold text-slate-800 text-xl">
                {editingBranch ? "Edit Cabang" : "Tambah Cabang"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Cabang *</label>
                <input
                  name="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Telepon</label>
                  <input
                    name="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Alamat Lengkap</label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={2}
                  className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kota</label>
                  <input
                    name="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Provinsi</label>
                  <input
                    name="province"
                    value={formData.province}
                    onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                    className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kode Pos</label>
                  <input
                    name="postalCode"
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                    className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Negara</label>
                  <input
                    name="country"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Warehouse ID</label>
                  <input
                    name="warehouseId"
                    value={formData.warehouseId}
                    onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                    placeholder="ID Warehouse"
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

              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-all mt-4"
              >
                {editingBranch ? "Update Cabang" : "Simpan Cabang"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
