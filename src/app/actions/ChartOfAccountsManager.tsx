"use client"

import { useState, useEffect } from "react"
import { getChartOfAccounts, createChartOfAccount, deleteChartOfAccount } from "@/app/actions/accounting"
import { Plus, Trash2, Folder, FileText } from "lucide-react"

type AccountRow = {
  id: string
  code: string
  name: string
  type: string
  isHeader: boolean
}

export default function ChartOfAccountsManager() {
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    type: "Asset",
    isHeader: false
  })

  const loadData = async () => {
    setLoading(true)
    const res = await getChartOfAccounts()
    if (res.success) {
      setAccounts(res.accounts as AccountRow[])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    const res = await createChartOfAccount(formData)
    if (res.success) {
      setShowModal(false)
      setFormData({ code: "", name: "", type: "Asset", isHeader: false })
      loadData()
    } else {
      alert(res.error)
    }
    setIsSubmitting(false)
  }

  const handleDelete = async (id: string) => {
    if (confirm("Hapus akun ini?")) {
      const res = await deleteChartOfAccount(id)
      if (res.success) {
        loadData()
      } else {
        alert(res.error)
      }
    }
  }

  const filteredAccounts = accounts.filter(acc =>
    acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    acc.code.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const groupedAccounts = filteredAccounts.reduce((acc, curr) => {
    if (!acc[curr.type]) acc[curr.type] = []
    acc[curr.type].push(curr)
    return acc
  }, {} as Record<string, AccountRow[]>)

  const typesOrder = ["Asset", "Liability", "Equity", "Revenue", "Expense"]

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Chart of Accounts (COA)</h2>
          <p className="text-sm text-slate-500">Manajemen daftar akun buku besar / kode perkiraan.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center mt-3 sm:mt-0">
          <input
            type="text"
            placeholder="Cari nama atau kode akun..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-auto rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <button 
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
          >
            <Plus size={16} /> Buat Akun Baru
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-slate-500">Memuat data akun...</div>
      ) : (
        <div className="space-y-6">
          {typesOrder.map(type => {
            const items = groupedAccounts[type] || []
            if (items.length === 0) return null
            
            return (
              <div key={type} className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <div className="bg-slate-100 border-b border-slate-200 px-4 py-3 font-bold text-slate-700">
                  {type.toUpperCase()}
                </div>
                <div className="p-0">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-white text-slate-500 border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-2 font-medium w-1/4">Kode Akun</th>
                        <th className="px-4 py-2 font-medium w-1/2">Nama Akun</th>
                        <th className="px-4 py-2 font-medium text-right w-1/4">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((acc) => (
                        <tr key={acc.id} className={acc.isHeader ? "bg-slate-50 font-semibold" : "hover:bg-slate-50"}>
                          <td className="px-4 py-2 text-slate-800">{acc.code}</td>
                          <td className="px-4 py-2 text-slate-700 flex items-center gap-2">
                            {acc.isHeader ? <Folder size={16} className="text-slate-400" /> : <FileText size={16} className="text-blue-400" />}
                            {acc.name}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <button onClick={() => handleDelete(acc.id)} className="text-red-500 hover:text-red-700">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Add Account */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-4 flex justify-between">
              <h3 className="font-bold text-lg">Buat Akun Baru</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-800">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Tipe Akun</label>
                <select value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})} className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-blue-500">
                  {typesOrder.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Kode Akun</label>
                <input required value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} placeholder="Contoh: 1100" className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-blue-500" />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Nama Akun</label>
                <input required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="Contoh: Kas Kecil" className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-blue-500" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formData.isHeader} onChange={(e) => setFormData({...formData, isHeader: e.target.checked})} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm font-medium text-slate-700">Akun Induk (Header Group)</span>
              </label>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Batal</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">Simpan Akun</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}