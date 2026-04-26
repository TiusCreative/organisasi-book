"use client"

import { useState, useEffect } from "react"
import { Plus, Edit2, Trash2, Building2, Truck } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Badge } from "@/components/ui/Badge"
import { Modal } from "@/components/ui/Modal"
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
        <Button
          variant={activeTab === "customers" ? "primary" : "outline"}
          onClick={() => setActiveTab("customers")}
          className="flex-1"
        >
          Customers
        </Button>
        <Button
          variant={activeTab === "suppliers" ? "primary" : "outline"}
          onClick={() => setActiveTab("suppliers")}
          className="flex-1"
        >
          Suppliers
        </Button>
      </div>

      {/* Add Button */}
      <div className="flex justify-end">
        <Button
          variant="secondary"
          onClick={() => {
            setEditingItem(null)
            setShowModal(true)
          }}
          className="flex items-center gap-2"
        >
          <Plus size={16} />
          {activeTab === "customers" ? "Tambah Customer" : "Tambah Supplier"}
        </Button>
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
                      <Badge variant={customer.status === "ACTIVE" ? "success" : "danger"}>
                        {customer.status}
                      </Badge>
                    </div>
                    {customer.email && <div className="text-sm text-slate-600">{customer.email}</div>}
                    {customer.phone && <div className="text-sm text-slate-600">{customer.phone}</div>}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingItem(customer)
                        setShowModal(true)
                      }}
                    >
                      <Edit2 size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(customer.id)}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 size={16} />
                    </Button>
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
                      <Badge variant={supplier.status === "ACTIVE" ? "success" : "danger"}>
                        {supplier.status}
                      </Badge>
                    </div>
                    {supplier.email && <div className="text-sm text-slate-600">{supplier.email}</div>}
                    {supplier.phone && <div className="text-sm text-slate-600">{supplier.phone}</div>}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingItem(supplier)
                        setShowModal(true)
                      }}
                    >
                      <Edit2 size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(supplier.id)}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={`${editingItem ? "Edit" : "Tambah"} ${activeTab === "customers" ? "Customer" : "Supplier"}`}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Nama"
            name="name"
            defaultValue={editingItem?.name}
            required
          />
          <Input
            label="Email"
            name="email"
            type="email"
            defaultValue={editingItem?.email}
          />
          <Input
            label="Telepon"
            name="phone"
            defaultValue={editingItem?.phone}
          />
          {editingItem && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                name="status"
                defaultValue={editingItem?.status}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          )}
          <div className="flex gap-2 pt-4">
            <Button type="submit" variant="secondary" className="flex-1">
              Simpan
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowModal(false)} className="flex-1">
              Batal
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
