"use client"

import { useState } from "react"
import { createCustomer, updateCustomer, deleteCustomer } from "@/app/actions/customer"
import { X, Plus, Edit, Trash2, Phone, Mail, MapPin, Building2 } from "lucide-react"

export default function CustomerManager({ customers, organizationId }: any) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<any>(null)
  const [formData, setFormData] = useState({
    name: "",
    contactPerson: "",
    email: "",
    phone: "",
    mobile: "",
    address: "",
    city: "",
    province: "",
    postalCode: "",
    country: "Indonesia",
    npwp: "",
    creditLimit: "0",
    paymentTerm: "30",
    status: "ACTIVE",
    notes: ""
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const data = new FormData()
    Object.entries(formData).forEach(([key, value]) => {
      data.append(key, value)
    })
    
    if (editingCustomer) {
      data.append("id", editingCustomer.id)
      await updateCustomer(data)
    } else {
      await createCustomer(data)
    }
    
    setIsModalOpen(false)
    setEditingCustomer(null)
    setFormData({
      name: "",
      contactPerson: "",
      email: "",
      phone: "",
      mobile: "",
      address: "",
      city: "",
      province: "",
      postalCode: "",
      country: "Indonesia",
      npwp: "",
      creditLimit: "0",
      paymentTerm: "30",
      status: "ACTIVE",
      notes: ""
    })
    window.location.reload()
  }

  const handleEdit = (customer: any) => {
    setEditingCustomer(customer)
    setFormData({
      name: customer.name,
      contactPerson: customer.contactPerson || "",
      email: customer.email || "",
      phone: customer.phone || "",
      mobile: customer.mobile || "",
      address: customer.address || "",
      city: customer.city || "",
      province: customer.province || "",
      postalCode: customer.postalCode || "",
      country: customer.country || "Indonesia",
      npwp: customer.npwp || "",
      creditLimit: String(customer.creditLimit),
      paymentTerm: String(customer.paymentTerm),
      status: customer.status,
      notes: customer.notes || ""
    })
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm("Yakin ingin menghapus customer ini?")) {
      await deleteCustomer(id)
      window.location.reload()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Customer Management</h1>
          <p className="text-slate-500">Kelola data customer perusahaan</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-blue-700 transition"
        >
          <Plus size={20} /> Tambah Customer
        </button>
      </div>

      {customers.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg">
          <Building2 size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">Belum ada customer. Klik "Tambah Customer" untuk menambahkan.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {customers.map((customer: any) => (
            <div key={customer.id} className="bg-white border rounded-lg p-5 hover:shadow-md transition">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-lg text-slate-800">{customer.name}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${customer.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                      {customer.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}
                    </span>
                    <span className="text-xs text-slate-400">{customer.code}</span>
                  </div>
                  
                  {customer.contactPerson && (
                    <p className="text-sm text-slate-600 mb-2">Kontak: {customer.contactPerson}</p>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">
                    {customer.email && (
                      <div className="flex items-center gap-2">
                        <Mail size={14} /> {customer.email}
                      </div>
                    )}
                    {customer.phone && (
                      <div className="flex items-center gap-2">
                        <Phone size={14} /> {customer.phone}
                      </div>
                    )}
                    {customer.mobile && (
                      <div className="flex items-center gap-2">
                        <Phone size={14} /> {customer.mobile} (HP)
                      </div>
                    )}
                    {customer.npwp && (
                      <div className="flex items-center gap-2">
                        <span>NPWP: {customer.npwp}</span>
                      </div>
                    )}
                  </div>

                  {customer.address && (
                    <div className="flex items-start gap-2 text-sm text-slate-600 mt-2">
                      <MapPin size={14} className="mt-0.5" />
                      <span>
                        {customer.address}
                        {customer.city && `, ${customer.city}`}
                        {customer.province && `, ${customer.province}`}
                        {customer.postalCode && ` ${customer.postalCode}`}
                      </span>
                    </div>
                  )}

                  <div className="flex gap-4 mt-3 text-sm">
                    <span className="text-slate-500">Limit Kredit: Rp {customer.creditLimit?.toLocaleString('id-ID')}</span>
                    <span className="text-slate-500">Term: {customer.paymentTerm} hari</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(customer)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(customer.id)}
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
                {editingCustomer ? "Edit Customer" : "Tambah Customer"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nama Customer *</label>
                  <input
                    name="name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kontak Person</label>
                  <input
                    name="contactPerson"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mobile (HP)</label>
                  <input
                    name="mobile"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">NPWP</label>
                  <input
                    name="npwp"
                    value={formData.npwp}
                    onChange={(e) => setFormData({ ...formData, npwp: e.target.value })}
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

              <div className="grid grid-cols-3 gap-4">
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">Limit Kredit</label>
                  <input
                    type="number"
                    name="creditLimit"
                    value={formData.creditLimit}
                    onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                    className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Term (hari)</label>
                  <input
                    type="number"
                    name="paymentTerm"
                    value={formData.paymentTerm}
                    onChange={(e) => setFormData({ ...formData, paymentTerm: e.target.value })}
                    className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
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

              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-all mt-4"
              >
                {editingCustomer ? "Update Customer" : "Simpan Customer"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
