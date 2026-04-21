"use client"

import { useState, useEffect } from "react"
import { Plus, Edit2, Trash2, Building2, Truck } from "lucide-react"
import { getCustomers, getSuppliers, createCustomer, updateCustomer, deleteCustomer, createSupplier, updateSupplier, deleteSupplier } from "../../app/actions/arap"

interface Customer {
  id: string
  code: string
  name: string
  email?: string
  phone?: string
  status: string
}

interface Supplier {
  id: string
  code: string
  name: string
  email?: string
  phone?: string
  status: string
}

export default function CustomerSupplierManager({ organizationId }: { organizationId: string }) {
  const [activeTab, setActiveTab] = useState<"customers" | "suppliers">("customers")
  const [customers, setCustomers] = useState<Customer[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)

  useEffect(() => {
    loadData()
  }, [activeTab])

  const loadData = async () => {
    setLoading(true)
    if (activeTab === "customers") {
      const result = await getCustomers()
      if (result.success) setCustomers(result.customers)
    } else {
      const result = await getSuppliers()
      if (result.success) setSuppliers(result.suppliers)
    }
    setLoading(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData(e.target as HTMLFormElement)
    
    if (activeTab === "customers") {
      if (editingItem) {
        formData.append("id", editingItem.id)
        await updateCustomer(formData)
      } else {
        await createCustomer(formData)
      }
    } else {
      if (editingItem) {
        formData.append("id", editingItem.id)
        await updateSupplier(formData)
      } else {
        await createSupplier(formData)
      }
    }
    
    setShowModal(false)
    setEditingItem(null)
    loadData()
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus?")) return
    
    if (activeTab === "customers") {
      await deleteCustomer(id)
    } else {
      await deleteSupplier(id)
    }
    loadData()
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("customers")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "customers"
              ? "bg-blue-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Customers
        </button>
        <button
          onClick={() => setActiveTab("suppliers")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "suppliers"
              ? "bg-orange-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Suppliers
        </button>
      </div>

      {/* Add Button */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            setEditingItem(null)
            setShowModal(true)
          }}
          className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
        >
          <Plus size={16} />
          {activeTab === "customers" ? "Tambah Customer" : "Tambah Supplier"}
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-8 text-center text-slate-500">Loading...</div>
      ) : (
        <div className="space-y-2">
          {activeTab === "customers" ? (
            customers.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
                <Building2 size={40} className="mx-auto mb-2 opacity-50" />
                <p>Belum ada customer</p>
              </div>
            ) : (
              customers.map((customer) => (
                <div
                  key={customer.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800">{customer.name}</span>
                      <span className="text-xs text-slate-500">{customer.code}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          customer.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}
                      >
                        {customer.status}
                      </span>
                    </div>
                    {customer.email && <div className="text-sm text-slate-600">{customer.email}</div>}
                    {customer.phone && <div className="text-sm text-slate-600">{customer.phone}</div>}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingItem(customer)
                        setShowModal(true)
                      }}
                      className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(customer.id)}
                      className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )
          ) : (
            suppliers.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
                <Truck size={40} className="mx-auto mb-2 opacity-50" />
                <p>Belum ada supplier</p>
              </div>
            ) : (
              suppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800">{supplier.name}</span>
                      <span className="text-xs text-slate-500">{supplier.code}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          supplier.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}
                      >
                        {supplier.status}
                      </span>
                    </div>
                    {supplier.email && <div className="text-sm text-slate-600">{supplier.email}</div>}
                    {supplier.phone && <div className="text-sm text-slate-600">{supplier.phone}</div>}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingItem(supplier)
                        setShowModal(true)
                      }}
                      className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(supplier.id)}
                      className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">
              {editingItem ? "Edit" : "Tambah"} {activeTab === "customers" ? "Customer" : "Supplier"}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama</label>
                <input
                  name="name"
                  defaultValue={editingItem?.name}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  name="email"
                  type="email"
                  defaultValue={editingItem?.email}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Telepon</label>
                <input
                  name="phone"
                  defaultValue={editingItem?.phone}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              {editingItem && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select
                    name="status"
                    defaultValue={editingItem?.status}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
                >
                  Simpan
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
