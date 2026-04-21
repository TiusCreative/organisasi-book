"use client"

import { useState } from "react"
import { X, Save, Edit2 } from "lucide-react"
import { updateTransaction } from "../../app/actions/transaction"
import { calculatePPN, calculatePPh23, formatRupiah } from "../../lib/tax-utils"

export default function EditTransactionModal({
  transaction,
  accounts,
  bankAccounts
}: {
  transaction: any
  accounts: any[]
  bankAccounts: any[]
}) {
  const bankAccountIds = new Set((bankAccounts || []).map((bank) => bank.accountId))
  const [isOpen, setIsOpen] = useState(false)
  const [transactionType, setTransactionType] = useState<"IN" | "OUT">(
    transaction.lines.some((line: any) => bankAccountIds.has(line.accountId) && line.debit > 0) ? "IN" : "OUT"
  )

  const bankLine = transaction.lines.find((line: any) => bankAccountIds.has(line.accountId))
  const categoryLine = transaction.lines.find((line: any) => !bankAccountIds.has(line.accountId))
  const ppnLine = transaction.lines.find((line: any) => {
    const name = String(line.account?.name || "").toLowerCase()
    return name.includes("ppn")
  })
  const pph23Line = transaction.lines.find((line: any) => {
    const name = String(line.account?.name || "").toLowerCase()
    return name.includes("pph 23")
  })
  const [amount, setAmount] = useState(String(categoryLine?.debit || categoryLine?.credit || 0))
  const [applyPPN, setApplyPPN] = useState(Boolean(ppnLine))
  const [includeTax, setIncludeTax] = useState(false)
  const [applyPPh23, setApplyPPh23] = useState(Boolean(pph23Line))
  const numericAmount = Number(amount || 0)
  const ppnPreview = applyPPN ? calculatePPN(numericAmount, 0.12, includeTax) : { base: numericAmount, tax: 0, total: numericAmount }
  const pph23Preview = transactionType === "OUT" && applyPPh23 ? calculatePPh23(ppnPreview.base) : { pph23: 0 }
  const settlementPreview = transactionType === "OUT"
    ? ppnPreview.total - pph23Preview.pph23
    : ppnPreview.total

  if (!isOpen) return (
    <button 
      onClick={() => setIsOpen(true)}
      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-slate-100 transition-colors"
      title="Edit Transaksi"
    >
      <Edit2 size={16} />
    </button>
  )

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-80 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-shrink-0">
          <h3 className="font-bold text-slate-800 text-xl">Edit Transaksi</h3>
          <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
        </div>

        <form action={async (formData) => {
          formData.set("type", transactionType)
          await updateTransaction(formData);
          setIsOpen(false);
        }} className="p-6 space-y-4 flex-1 overflow-y-auto">
          <input type="hidden" name="id" value={transaction.id} />
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Tipe Transaksi</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTransactionType("IN")}
                className={`py-2 rounded-lg font-bold transition-colors ${
                  transactionType === "IN"
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Masuk
              </button>
              <button
                type="button"
                onClick={() => setTransactionType("OUT")}
                className={`py-2 rounded-lg font-bold transition-colors ${
                  transactionType === "OUT"
                    ? "bg-rose-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Keluar
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Keterangan</label>
            <input 
              name="description" 
              required 
              defaultValue={transaction.description}
              placeholder="Contoh: Bayar Listrik April" 
              className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none" 
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Nominal (Rp)</label>
            <input 
              name="amount" 
              type="number" 
              required 
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0" 
              className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none" 
            />
          </div>

          <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-700">Tambahkan PPN 12%</label>
              <input
                name="applyPPN"
                type="checkbox"
                checked={applyPPN}
                onChange={(event) => setApplyPPN(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
            </div>

            {applyPPN && (
              <label className="flex items-center justify-between text-sm text-slate-600">
                <span>Nominal sudah termasuk PPN</span>
                <input
                  name="includeTax"
                  type="checkbox"
                  checked={includeTax}
                  onChange={(event) => setIncludeTax(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
              </label>
            )}

            {transactionType === "OUT" && (
              <label className="flex items-center justify-between text-sm text-slate-600">
                <span>Potong PPh 23 otomatis</span>
                <input
                  name="applyPPh23"
                  type="checkbox"
                  checked={applyPPh23}
                  onChange={(event) => setApplyPPh23(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
              </label>
            )}

            {numericAmount > 0 && (
              <div className="rounded-lg bg-white border border-slate-200 p-3 text-sm text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span>DPP</span>
                  <span className="font-medium text-slate-800">{formatRupiah(ppnPreview.base)}</span>
                </div>
                <div className="flex justify-between">
                  <span>PPN</span>
                  <span className="font-medium text-slate-800">{formatRupiah(ppnPreview.tax)}</span>
                </div>
                {transactionType === "OUT" && applyPPh23 && (
                  <div className="flex justify-between">
                    <span>PPh 23</span>
                    <span className="font-medium text-slate-800">{formatRupiah(pph23Preview.pph23)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-slate-200 font-bold text-slate-800">
                  <span>{transactionType === "OUT" ? "Pembayaran Bank" : "Penerimaan Bank"}</span>
                  <span>{formatRupiah(settlementPreview)}</span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Rekening Bank</label>
            <select 
              name="bankAccountId" 
              required 
              defaultValue={bankLine?.accountId}
              className="w-full p-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">-- Pilih Rekening --</option>
              {bankAccounts.map((bank) => (
                <option key={bank.id} value={bank.accountId}>
                  {bank.bankName} - {bank.accountNumber} ({bank.accountName})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Kategori / Akun</label>
            <select 
              name="categoryAccountId" 
              required 
              defaultValue={categoryLine?.accountId}
              className="w-full p-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">-- Pilih Kategori --</option>
              {accounts.filter((account) => !bankAccountIds.has(account.id)).map(acc => (
                <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
              ))}
            </select>
          </div>

          <button 
            type="submit" 
            className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all mt-4"
          >
            <Save size={20} /> Simpan Perubahan
          </button>
        </form>
      </div>
    </div>
  )
}
