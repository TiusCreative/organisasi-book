"use client"

import { useState } from "react"
import { updateCoaMapping, type AccountingMappingInput } from "@/app/actions/accounting-settings"

type AccountOption = {
  id: string
  code: string
  name: string
  type: string
}

type Props = {
  initialConfig: AccountingMappingInput | null
  accounts: AccountOption[]
}

export default function AccountingConfigForm({ initialConfig, accounts }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const [formData, setFormData] = useState<AccountingMappingInput>({
    salesAccountId: initialConfig?.salesAccountId || "",
    salesDiscountAccountId: initialConfig?.salesDiscountAccountId || "",
    salesReturnAccountId: initialConfig?.salesReturnAccountId || "",
    ppnOutputAccountId: initialConfig?.ppnOutputAccountId || "",
    ppnInputAccountId: initialConfig?.ppnInputAccountId || "",
    pph23PayableAccountId: initialConfig?.pph23PayableAccountId || "",
    inventoryAccountId: initialConfig?.inventoryAccountId || "",
    cogsAccountId: initialConfig?.cogsAccountId || "",
  })

  const handleChange = (field: keyof AccountingMappingInput, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value === "" ? null : value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage(null)

    try {
      const result = await updateCoaMapping(formData)
      if (result.success) {
        setMessage({ type: 'success', text: 'Konfigurasi pemetaan akun berhasil disimpan.' })
      } else {
        setMessage({ type: 'error', text: result.error || 'Gagal menyimpan konfigurasi.' })
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Terjadi kesalahan sistem.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Filter helper untuk mempersempit daftar pilihan akun berdasarkan tipe
  const revenueAccounts = accounts.filter(a => a.type === "Revenue")
  const expenseAccounts = accounts.filter(a => a.type === "Expense")
  const liabilityAccounts = accounts.filter(a => a.type === "Liability")
  const assetAccounts = accounts.filter(a => a.type === "Asset")

  const SelectField = ({ label, field, options }: { label: string, field: keyof AccountingMappingInput, options: AccountOption[] }) => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select
        value={formData[field] || ""}
        onChange={(e) => handleChange(field, e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
      >
        <option value="">-- Pilih Akun --</option>
        {options.map((acc) => (
          <option key={acc.id} value={acc.id}>
            [{acc.code}] {acc.name}
          </option>
        ))}
      </select>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-8 bg-white p-6 rounded-lg shadow-sm border border-gray-100">
      {message && (
        <div className={`p-4 rounded-md text-sm ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        {/* SECTION: Penjualan */}
        <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
          <h3 className="text-md font-bold text-gray-800 mb-4 border-b pb-2">Modul Penjualan (Sales)</h3>
          <SelectField 
            label="Default Pendapatan Penjualan" 
            field="salesAccountId" 
            options={revenueAccounts} 
          />
          <SelectField 
            label="Default Diskon Penjualan" 
            field="salesDiscountAccountId" 
            options={revenueAccounts} 
          />
          <SelectField 
            label="Default Retur Penjualan" 
            field="salesReturnAccountId" 
            options={revenueAccounts} 
          />
        </div>

        {/* SECTION: Pajak */}
        <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
          <h3 className="text-md font-bold text-gray-800 mb-4 border-b pb-2">Modul Pajak & PPN</h3>
          <SelectField 
            label="Hutang PPN (Keluaran / Output)" 
            field="ppnOutputAccountId" 
            options={liabilityAccounts} 
          />
          <SelectField 
            label="Piutang PPN (Masukan / Input)" 
            field="ppnInputAccountId" 
            options={assetAccounts.concat(liabilityAccounts)} 
          />
          <SelectField 
            label="Hutang PPh 23 (Terutang)" 
            field="pph23PayableAccountId" 
            options={liabilityAccounts} 
          />
        </div>

        {/* SECTION: Inventori & HPP */}
        <div className="bg-gray-50 p-4 rounded-md border border-gray-200 md:col-span-2 lg:col-span-1">
          <h3 className="text-md font-bold text-gray-800 mb-4 border-b pb-2">Inventori & Harga Pokok</h3>
          <SelectField 
            label="Default Akun Persediaan Barang" 
            field="inventoryAccountId" 
            options={assetAccounts} 
          />
          <SelectField 
            label="Default Harga Pokok Penjualan (HPP)" 
            field="cogsAccountId" 
            options={expenseAccounts} 
          />
        </div>
      </div>

      <div className="pt-4 border-t flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? "Menyimpan..." : "Simpan Pengaturan"}
        </button>
      </div>
    </form>
  )
}