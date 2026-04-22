"use client"

import { useState } from "react"
import { createBankReconciliation, updateBankReconciliationStatus } from "@/app/actions/bank-reconciliation"

interface ReconciliationTabProps {
  bankAccounts: any[]
  reconciliations: any[]
  organizationId: string
}

export default function ReconciliationTab({ bankAccounts, reconciliations, organizationId }: ReconciliationTabProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState({
    bankAccountId: "",
    reconciliationDate: new Date().toISOString().split('T')[0],
    statementBalance: "",
    bookBalance: "",
    notes: ""
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createBankReconciliation({
        organizationId,
        bankAccountId: formData.bankAccountId,
        reconciliationDate: new Date(formData.reconciliationDate),
        statementBalance: parseFloat(formData.statementBalance),
        bookBalance: parseFloat(formData.bookBalance),
        notes: formData.notes || undefined
      })
      setIsOpen(false)
      setFormData({
        bankAccountId: "",
        reconciliationDate: new Date().toISOString().split('T')[0],
        statementBalance: "",
        bookBalance: "",
        notes: ""
      })
      window.location.reload()
    } catch (error) {
      console.error("Error creating reconciliation:", error)
    }
  }

  const handleStatusChange = async (id: string, status: "PENDING" | "RECONCILED") => {
    try {
      await updateBankReconciliationStatus(id, status)
      window.location.reload()
    } catch (error) {
      console.error("Error updating status:", error)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Rekonsiliasi Bank</h2>
          <p className="text-sm text-slate-500">Pencocokan data bank dengan rekening koran</p>
        </div>
        <button
          onClick={() => setIsOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Buat Rekonsiliasi
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Buat Rekonsiliasi Bank Baru</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Rekening Bank</label>
                <select
                  value={formData.bankAccountId}
                  onChange={(e) => setFormData({ ...formData, bankAccountId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                >
                  <option value="">Pilih rekening bank</option>
                  {bankAccounts.map((bank) => (
                    <option key={bank.id} value={bank.id}>
                      {bank.bankName} - {bank.accountNumber}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tanggal Rekonsiliasi</label>
                <input
                  type="date"
                  value={formData.reconciliationDate}
                  onChange={(e) => setFormData({ ...formData, reconciliationDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Saldo Rekening Koran</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.statementBalance}
                  onChange={(e) => setFormData({ ...formData, statementBalance: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Saldo Buku</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.bookBalance}
                  onChange={(e) => setFormData({ ...formData, bookBalance: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Catatan</label>
                <input
                  placeholder="Catatan rekonsiliasi"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {reconciliations.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <p className="text-center text-slate-500">Belum ada rekonsiliasi bank</p>
          </div>
        ) : (
          reconciliations.map((rec) => {
            const difference = rec.statementBalance - rec.bookBalance
            return (
              <div key={rec.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-base">
                      {rec.bankAccount?.bankName} - {rec.bankAccount?.accountNumber}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {new Date(rec.reconciliationDate).toLocaleDateString('id-ID')}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    rec.status === "RECONCILED" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700"
                  }`}>
                    {rec.status === "RECONCILED" ? "Sudah Reconcile" : "Pending"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                  <div>
                    <p className="text-slate-500">Saldo Rekening Koran</p>
                    <p className="font-semibold">{rec.statementBalance.toLocaleString('id-ID')}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Saldo Buku</p>
                    <p className="font-semibold">{rec.bookBalance.toLocaleString('id-ID')}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Selisih</p>
                    <p className={`font-semibold ${difference === 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {difference.toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>
                {rec.status === "PENDING" && (
                  <button
                    onClick={() => handleStatusChange(rec.id, "RECONCILED")}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    Mark as Reconciled
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
