"use client"

import { useState } from "react"
import { X, Save, RotateCcw } from "lucide-react"
import { updateBankAccount, reconcileBankAccount } from "../../app/actions/bank"

interface BankEditModalProps {
  bank: any
}

export default function BankEditModal({ bank }: BankEditModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"edit" | "reconcile">("edit")

  if (!isOpen) return (
    <button 
      onClick={() => setIsOpen(true)}
      className="text-sm font-bold text-slate-400 hover:text-blue-600 transition"
    >
      Edit Detail
    </button>
  )

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-shrink-0">
          <h3 className="font-bold text-slate-800 text-xl">Kelola Rekening</h3>
          <button 
            onClick={() => {
              setIsOpen(false)
            }} 
            className="text-slate-400 hover:text-slate-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100">
          <button
            onClick={() => setActiveTab("edit")}
            className={`flex-1 py-3 text-center font-bold text-sm transition-colors ${
              activeTab === "edit"
                ? "bg-blue-50 text-blue-600 border-b-2 border-blue-600"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            Edit Detail
          </button>
          <button
            onClick={() => setActiveTab("reconcile")}
            className={`flex-1 py-3 text-center font-bold text-sm transition-colors ${
              activeTab === "reconcile"
                ? "bg-blue-50 text-blue-600 border-b-2 border-blue-600"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            Rekonsiliasi
          </button>
        </div>

        {/* Edit Tab */}
        {activeTab === "edit" && (
          <form action={async (formData) => {
            await updateBankAccount(formData);
            setIsOpen(false);
          }} className="p-6 space-y-4">
            <input type="hidden" name="id" value={bank.id} />
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Nama Bank</label>
              <input 
                name="bankName" 
                required 
                defaultValue={bank.bankName}
                placeholder="Contoh: BCA, Mandiri, BSI" 
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" 
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Nomor Rekening</label>
              <input 
                name="accountNumber" 
                required 
                defaultValue={bank.accountNumber}
                placeholder="1234567890" 
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" 
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Atas Nama</label>
              <input 
                name="accountName" 
                required 
                defaultValue={bank.accountName}
                placeholder="Nama pemilik rekening" 
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" 
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Saldo Awal / Saldo Statement</label>
              <input
                name="balance"
                type="number"
                inputMode="decimal"
                required
                defaultValue={bank.balance || 0}
                placeholder="0"
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <p className="text-xs text-slate-500 mt-2">Nilai ini bisa diedit kapan saja untuk menyesuaikan saldo awal atau saldo statement bank.</p>
            </div>

            <button 
              type="submit" 
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all mt-4"
            >
              <Save size={18} /> Simpan Perubahan
            </button>
          </form>
        )}

        {/* Reconciliation Tab */}
        {activeTab === "reconcile" && (
          <form action={async (formData) => {
            await reconcileBankAccount(formData);
            setIsOpen(false);
          }} className="p-6 space-y-4">
            <input type="hidden" name="bankAccountId" value={bank.id} />
            
            <div className="bg-slate-50 p-4 rounded-xl mb-4">
              <p className="text-xs text-slate-500 mb-1">Saldo Terakhir</p>
              <p className="text-2xl font-bold text-slate-800">
                Rp {bank.balance?.toLocaleString('id-ID') || '0'}
              </p>
              {bank.lastReconciled && (
                <p className="text-xs text-slate-400 mt-2">
                  Terakhir direkonsiliasi: {new Date(bank.lastReconciled).toLocaleDateString('id-ID')}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Saldo Bank Saat Ini (Rp)</label>
              <input 
                name="newBalance" 
                type="number"
                inputMode="decimal"
                required 
                placeholder="Masukkan saldo dari bank statement" 
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" 
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Catatan</label>
              <textarea 
                name="notes" 
                placeholder="Masukkan catatan reconciliation (opsional)"
                defaultValue={bank.notes || ''}
                rows={3}
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              />
            </div>

            <button 
              type="submit" 
              className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all mt-4"
            >
              <RotateCcw size={18} /> Rekonsiliasi Sekarang
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
