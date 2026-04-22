"use client"

import { useState } from "react"
import { createBudget, updateBudget, approveBudget, deleteBudget } from "@/app/actions/budget"
import { X, Plus, Edit, Trash2, CheckCircle, TrendingUp, TrendingDown, DollarSign, Calendar } from "lucide-react"

export default function BudgetManager({ budgets, organizationId }: any) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<any>(null)
  const [formData, setFormData] = useState({
    year: new Date().getFullYear(),
    divisionId: "",
    name: "",
    periodType: "ANNUAL",
    totalBudget: "0",
    status: "DRAFT",
    notes: ""
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const data = new FormData()
    Object.entries(formData).forEach(([key, value]) => {
      data.append(key, value)
    })
    
    if (editingBudget) {
      data.append("id", editingBudget.id)
      await updateBudget(data)
    } else {
      await createBudget(data)
    }
    
    setIsModalOpen(false)
    setEditingBudget(null)
    setFormData({
      year: new Date().getFullYear(),
      divisionId: "",
      name: "",
      periodType: "ANNUAL",
      totalBudget: "0",
      status: "DRAFT",
      notes: ""
    })
    window.location.reload()
  }

  const handleEdit = (budget: any) => {
    setEditingBudget(budget)
    setFormData({
      year: budget.year,
      divisionId: budget.divisionId || "",
      name: budget.name,
      periodType: budget.periodType,
      totalBudget: String(budget.totalBudget),
      status: budget.status,
      notes: budget.notes || ""
    })
    setIsModalOpen(true)
  }

  const handleApprove = async (id: string) => {
    if (confirm("Yakin ingin approve budget ini?")) {
      await approveBudget(id)
      window.location.reload()
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm("Yakin ingin menghapus budget ini?")) {
      await deleteBudget(id)
      window.location.reload()
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0
    }).format(amount)
  }

  const formatPercent = (percent: number) => {
    return `${percent.toFixed(1)}%`
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Budget Management</h1>
          <p className="text-slate-500">Kelola anggaran dan monitoring budget vs actual per divisi</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-blue-700 transition"
        >
          <Plus size={20} /> Tambah Budget
        </button>
      </div>

      {budgets.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg">
          <DollarSign size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">Belum ada budget. Klik "Tambah Budget" untuk menambahkan.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {budgets.map((budget: any) => (
            <div key={budget.id} className="bg-white border rounded-lg p-5 hover:shadow-md transition">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-lg text-slate-800">{budget.name}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      budget.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                      budget.status === 'ACTIVE' ? 'bg-blue-100 text-blue-700' :
                      budget.status === 'DRAFT' ? 'bg-slate-100 text-slate-600' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {budget.status}
                    </span>
                    <span className="text-xs text-slate-400">{budget.code}</span>
                  </div>

                  <div className="flex gap-4 text-sm text-slate-600 mb-2">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} />
                      <span>Tahun: {budget.year}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>Periode: {budget.periodType}</span>
                    </div>
                    {budget.division && (
                      <div className="flex items-center gap-2">
                        <span>Divisi: {budget.division.name}</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <div className="text-xs text-slate-600 mb-1">Total Budget</div>
                      <div className="font-bold text-blue-700">{formatCurrency(budget.totalBudget)}</div>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="text-xs text-slate-600 mb-1">Total Actual</div>
                      <div className="font-bold text-green-700">{formatCurrency(budget.totalActual)}</div>
                    </div>
                    <div className={`p-3 rounded-lg ${budget.variance >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                      <div className="text-xs text-slate-600 mb-1">Variance</div>
                      <div className={`font-bold ${budget.variance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {formatCurrency(budget.variance)} ({formatPercent(budget.variancePercent)})
                      </div>
                    </div>
                  </div>

                  {budget.approver && (
                    <div className="text-xs text-slate-500 mt-2">
                      Approved by: {budget.approver.name} on {new Date(budget.approvedAt).toLocaleDateString('id-ID')}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {budget.status === 'DRAFT' && (
                    <button
                      onClick={() => handleApprove(budget.id)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                      title="Approve"
                    >
                      <CheckCircle size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(budget)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(budget.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {budget.items && budget.items.length > 0 && (
                <div className="border-t pt-4 mt-4">
                  <p className="text-sm font-medium text-slate-700 mb-2">Budget Items ({budget._count.items})</p>
                  <div className="max-h-40 overflow-y-auto">
                    {budget.items.slice(0, 5).map((item: any) => (
                      <div key={item.id} className="flex justify-between text-xs text-slate-600 py-1 border-b last:border-0">
                        <span>{item.itemName}</span>
                        <span>{formatCurrency(item.budgetAmount)}</span>
                      </div>
                    ))}
                    {budget.items.length > 5 && (
                      <p className="text-xs text-slate-400 mt-2">+ {budget.items.length - 5} items lagi</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-shrink-0">
              <h3 className="font-bold text-slate-800 text-xl">
                {editingBudget ? "Edit Budget" : "Tambah Budget"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tahun Anggaran *</label>
                <input
                  type="number"
                  name="year"
                  required
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                  className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Budget *</label>
                <input
                  name="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Divisi (Optional)</label>
                <input
                  name="divisionId"
                  value={formData.divisionId}
                  onChange={(e) => setFormData({ ...formData, divisionId: e.target.value })}
                  placeholder="ID Divisi/Departemen"
                  className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipe Periode</label>
                <select
                  name="periodType"
                  value={formData.periodType}
                  onChange={(e) => setFormData({ ...formData, periodType: e.target.value })}
                  className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="ANNUAL">Tahunan</option>
                  <option value="QUARTERLY">Kuartalan</option>
                  <option value="MONTHLY">Bulanan</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Total Budget *</label>
                <input
                  type="number"
                  name="totalBudget"
                  required
                  value={formData.totalBudget}
                  onChange={(e) => setFormData({ ...formData, totalBudget: e.target.value })}
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
                  <option value="DRAFT">Draft</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="ACTIVE">Active</option>
                  <option value="CLOSED">Closed</option>
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
                {editingBudget ? "Update Budget" : "Simpan Budget"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
