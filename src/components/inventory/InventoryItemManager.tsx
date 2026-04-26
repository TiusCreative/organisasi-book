"use client"

import React, { useState, useEffect } from "react"
import { DataTable, ColumnDef } from "@/components/ui/DataTable"
import { Modal } from "@/components/ui/Modal"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Badge } from "@/components/ui/Badge"
import { Alert } from "@/components/ui/Alert"
import { Plus, Edit, Trash2, Package, AlertTriangle, Search, ClipboardCheck } from "lucide-react"
import { getInventoryItems, createInventoryItem, updateInventoryItem, deleteInventoryItem, getWarehouses } from "@/app/actions/inventory"
import Link from "next/link"

export default function InventoryItemManager({ organizationId }: { organizationId: string }) {
  const [items, setItems] = useState<any[]>([]) // Placeholder untuk data inventory
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<any>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [searchQuery, setSearchQuery] = useState("")
  const [alertMessage, setAlertMessage] = useState<{type: "success"|"error"|"warning"|"info", text: string} | null>(null)
  const [formData, setFormData] = useState({
    code: "", name: "", unit: "PCS", unitCost: 0, barcode: "", warehouseId: ""
  })

  const showAlert = (type: "success"|"error"|"warning"|"info", text: string) => {
    setAlertMessage({ type, text })
    setTimeout(() => setAlertMessage(null), 5000)
  }

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [itemsData, whData] = await Promise.all([
        getInventoryItems(organizationId),
        getWarehouses(organizationId)
      ])
      setItems(itemsData)
      setWarehouses(whData)
      if (whData.length > 0) {
        setFormData(prev => ({ ...prev, warehouseId: prev.warehouseId || whData[0].id }))
      }
    } catch (error: any) {
      showAlert("error", error.message || "Gagal memuat data inventori")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [organizationId])

  const openEditModal = (item: any) => {
    setFormData({
      code: item.code,
      name: item.name,
      unit: item.unit,
      unitCost: item.unitCost,
      barcode: item.barcode || "",
      warehouseId: item.warehouseId || warehouses[0]?.id || ""
    })
    setEditingId(item.id)
    setIsModalOpen(true)
  }

  const openDeleteModal = (item: any) => {
    setItemToDelete(item)
    setIsDeleteModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingId(null)
    setFormData({ code: "", name: "", unit: "PCS", unitCost: 0, barcode: "", warehouseId: warehouses[0]?.id || "" })
  }

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.barcode && item.barcode.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // Konfigurasi Kolom DataTable menggunakan UI Catalog
  const columns: ColumnDef<any>[] = [
    {
      header: "Kode & Barcode",
      cell: (row) => (
        <div>
          <div className="font-bold text-slate-800">{row.code}</div>
          <div className="text-xs text-slate-500">{row.barcode || "-"}</div>
        </div>
      )
    },
    {
      header: "Nama Barang",
      cell: (row) => <span className="font-medium">{row.name}</span>
    },
    {
      header: "Kuantitas Stok",
      cell: (row) => (
        <Badge variant={row.quantity > 10 ? "success" : "danger"}>
          {row.quantity || 0} {row.unit}
        </Badge>
      )
    },
    {
      header: "Aksi",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" className="text-blue-600 hover:bg-blue-50" onClick={() => openEditModal(row)}>
            <Edit size={16} />
          </Button>
          <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => openDeleteModal(row)}>
            <Trash2 size={16} />
          </Button>
        </div>
      ),
      className: "text-right"
    }
  ]

  const handleSave = async () => {
    if (!formData.code || !formData.name || !formData.warehouseId) {
      return showAlert("error", "Kode, Nama, dan Gudang wajib diisi")
    }
    setIsSubmitting(true)
    try {
      if (editingId) {
        await updateInventoryItem(editingId, {
          organizationId,
          ...formData
        })
        showAlert("success", "Data barang berhasil diperbarui!")
      } else {
        await createInventoryItem({
          organizationId,
          ...formData
        })
        showAlert("success", "Data barang berhasil disimpan!")
      }
      handleCloseModal()
      loadData()
    } catch (error: any) {
      showAlert("error", error.message || "Gagal menyimpan barang")
    } finally {
      setIsSubmitting(false)
    }
  }

  const confirmDelete = async () => {
    if (!itemToDelete) return
    setIsSubmitting(true)
    try {
      await deleteInventoryItem(itemToDelete.id, organizationId)
      showAlert("success", "Barang berhasil dihapus")
      setIsDeleteModalOpen(false)
      setItemToDelete(null)
      loadData()
    } catch (e: any) {
      showAlert("error", e.message || "Gagal menghapus barang")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 relative">
      {/* Toast Notification */}
      {alertMessage && (
        <div className="fixed top-6 right-6 z-[100] animate-in fade-in slide-in-from-top-4">
          <Alert variant={alertMessage.type} onClose={() => setAlertMessage(null)} className="shadow-lg min-w-[300px] bg-white">
            {alertMessage.text}
          </Alert>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-bold text-slate-800">Master Inventori</h2>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Cari kode atau nama..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Link href={`/inventory?tab=opname`}>
            <Button variant="outline" className="text-slate-600 bg-white">
              <ClipboardCheck size={16} className="mr-1" /> Stock Opname
            </Button>
          </Link>
          <Button variant="primary" onClick={() => { setEditingId(null); setIsModalOpen(true); }}>
            <Plus size={16} className="mr-1" /> Tambah Barang
          </Button>
        </div>
      </div>

      <DataTable 
        columns={columns} 
        data={filteredItems} 
        isLoading={isLoading} 
        emptyState={
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
            <Package size={48} className="mb-3 text-slate-300" />
            <p className="text-base font-medium text-slate-600">Belum ada barang persediaan</p>
            <p className="text-sm mt-1">Tambahkan barang untuk mulai mengelola stok gudang Anda.</p>
          </div>
        }
      />

      <Modal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal}
        title={editingId ? "Edit Data Barang" : "Tambah Barang Baru"}
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Pilih Gudang Asal <span className="text-red-500">*</span></label>
            <select 
              value={formData.warehouseId} 
              onChange={(e) => setFormData({...formData, warehouseId: e.target.value})}
              className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none bg-white"
            >
              <option value="">-- Pilih Gudang --</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Kode Barang <span className="text-red-500">*</span></label>
            <Input placeholder="Contoh: ITM-001" value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Nama Barang <span className="text-red-500">*</span></label>
            <Input placeholder="Contoh: Kertas A4 80gr" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Satuan (UoM)</label>
              <Input placeholder="PCS, BOX, LTR" value={formData.unit} onChange={(e) => setFormData({...formData, unit: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Harga Beli / HPP</label>
              <Input type="number" placeholder="0" value={formData.unitCost || ""} onChange={(e) => setFormData({...formData, unitCost: Number(e.target.value)})} />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4 mt-2 border-t border-slate-100">
            <Button variant="outline" onClick={handleCloseModal}>Batal</Button>
            <Button variant="primary" onClick={handleSave} isLoading={isSubmitting}>
              {editingId ? "Simpan Perubahan" : "Simpan Barang"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Konfirmasi Hapus"
        maxWidth="sm"
      >
        <div className="flex flex-col items-center justify-center p-2 text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-2">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-slate-600 text-sm">Apakah Anda yakin ingin menghapus barang <strong>{itemToDelete?.name}</strong>?</p>
            <p className="text-xs text-red-500 mt-2 font-medium">Tindakan ini tidak dapat dibatalkan jika barang belum memiliki histori.</p>
          </div>
          <div className="flex w-full justify-end gap-2 pt-4 border-t border-slate-100 mt-4">
            <Button variant="outline" className="w-full" onClick={() => setIsDeleteModalOpen(false)}>Batal</Button>
            <Button variant="danger" className="w-full" onClick={confirmDelete} isLoading={isSubmitting}>Ya, Hapus</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}