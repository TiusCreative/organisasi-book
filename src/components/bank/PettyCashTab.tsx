"use client"

import { useState } from "react"
import { createPettyCash, createPettyCashTransaction } from "@/app/actions/petty-cash"

interface PettyCashTabProps {
  pettyCashAccounts: any[]
  organizationId: string
}

export default function PettyCashTab({ pettyCashAccounts, organizationId }: PettyCashTabProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isTransactionOpen, setIsTransactionOpen] = useState(false)
  const [selectedPettyCash, setSelectedPettyCash] = useState<any>(null)
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    currencyId: "",
    fundType: "IMPREST" as "IMPREST" | "FLUKTUASI",
    initialAmount: "",
    location: "",
    notes: ""
  })
  const [transactionForm, setTransactionForm] = useState({
    transactionType: "DISBURSEMENT" as "REPLENISH" | "DISBURSEMENT" | "ADJUSTMENT",
    amount: "",
    description: "",
    reference: ""
  })

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createPettyCash({
        organizationId,
        name: formData.name,
        code: formData.code,
        currencyId: formData.currencyId,
        fundType: formData.fundType,
        initialAmount: parseFloat(formData.initialAmount),
        location: formData.location || undefined,
        notes: formData.notes || undefined
      })
      setIsCreateOpen(false)
      setFormData({
        name: "",
        code: "",
        currencyId: "",
        fundType: "IMPREST",
        initialAmount: "",
        location: "",
        notes: ""
      })
      window.location.reload()
    } catch (error) {
      console.error("Error creating petty cash:", error)
    }
  }

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPettyCash) return

    try {
      await createPettyCashTransaction({
        pettyCashId: selectedPettyCash.id,
        transactionType: transactionForm.transactionType,
        amount: parseFloat(transactionForm.amount),
        description: transactionForm.description,
        reference: transactionForm.reference || undefined
      })
      setIsTransactionOpen(false)
      setTransactionForm({
        transactionType: "DISBURSEMENT",
        amount: "",
        description: "",
        reference: ""
      })
      window.location.reload()
    } catch (error) {
      console.error("Error creating transaction:", error)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Kas Kecil (Petty Cash)</h2>
          <p className="text-sm text-slate-500">Pengeluaran operasional harian dengan sistem imprest/fluktuasi</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Buat Kas Kecil
        </button>
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Buat Kas Kecil Baru</h3>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nama Kas Kecil</label>
                <input
                  placeholder="Kas Kecil Marketing"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Kode</label>
                <input
                  placeholder="KK-MKT"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tipe Dana</label>
                <select
                  value={formData.fundType}
                  onChange={(e) => setFormData({ ...formData, fundType: e.target.value as "IMPREST" | "FLUKTUASI" })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="IMPREST">Imprest (Tetap)</option>
                  <option value="FLUKTUASI">Fluktuasi (Berubah)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Saldo Awal</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.initialAmount}
                  onChange={(e) => setFormData({ ...formData, initialAmount: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Lokasi</label>
                <input
                  placeholder="Kantor Pusat"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
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

      <div className="grid gap-4 md:grid-cols-2">
        {pettyCashAccounts.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-6 col-span-2">
            <p className="text-center text-slate-500">Belum ada kas kecil</p>
          </div>
        ) : (
          pettyCashAccounts.map((pc) => (
            <div key={pc.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-base">{pc.name}</h3>
                  <p className="text-sm text-slate-500">
                    {pc.code} • {pc.fundType}
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                  {pc.currency?.symbol}
                </span>
              </div>
              <div className="space-y-3 mb-4">
                <div>
                  <p className="text-sm text-slate-500">Saldo Saat Ini</p>
                  <p className="text-2xl font-bold">{pc.currentAmount.toLocaleString('id-ID')}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedPettyCash(pc)
                  setIsTransactionOpen(true)
                }}
                className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Transaksi
              </button>
            </div>
          ))
        )}
      </div>

      {isTransactionOpen && selectedPettyCash && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-1">Transaksi Kas Kecil</h3>
            <p className="text-sm text-slate-500 mb-4">{selectedPettyCash.name}</p>
            <form onSubmit={handleTransactionSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tipe Transaksi</label>
                <select
                  value={transactionForm.transactionType}
                  onChange={(e) => setTransactionForm({ ...transactionForm, transactionType: e.target.value as "REPLENISH" | "DISBURSEMENT" | "ADJUSTMENT" })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="REPLENISH">Isi Ulang (Replenish)</option>
                  <option value="DISBURSEMENT">Pengeluaran (Disbursement)</option>
                  <option value="ADJUSTMENT">Penyesuaian (Adjustment)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Jumlah</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={transactionForm.amount}
                  onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Keterangan</label>
                <input
                  placeholder="Keterangan transaksi"
                  value={transactionForm.description}
                  onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Referensi</label>
                <input
                  placeholder="Nomor referensi"
                  value={transactionForm.reference}
                  onChange={(e) => setTransactionForm({ ...transactionForm, reference: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsTransactionOpen(false)}
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
    </div>
  )
}
