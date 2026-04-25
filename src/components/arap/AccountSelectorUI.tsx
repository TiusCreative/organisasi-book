"use client"

import { useState, useEffect } from "react"
import { getChartOfAccounts } from "@/app/actions/accounting"

type Props = {
  type: "AR" | "AP" // AR = Piutang (untuk Invoice), AP = Hutang (untuk Vendor Bill)
  name: string // name attribute untuk FormData (contoh: "piutangAccountId" atau "hutangAccountId")
  required?: boolean
}

export default function AccountSelectorUI({ type, name, required = true }: Props) {
  const [accounts, setAccounts] = useState<{ id: string, code: string, name: string }[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchAccounts() {
      const res = await getChartOfAccounts()
      if (res.success && res.accounts) {
        // Jika AR (Piutang) -> Ambil tipe Asset
        // Jika AP (Hutang) -> Ambil tipe Liability
        const filtered = res.accounts.filter(a => 
          !a.isHeader && (type === "AR" ? a.type === "Asset" : a.type === "Liability")
        )
        setAccounts(filtered)
      }
      setIsLoading(false)
    }
    fetchAccounts()
  }, [type])

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Akun {type === "AR" ? "Piutang Usaha" : "Hutang Usaha"} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        name={name}
        required={required}
        disabled={isLoading}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white disabled:opacity-50"
      >
        <option value="">{isLoading ? "Memuat akun..." : `-- Pilih Akun ${type === "AR" ? "Piutang" : "Hutang"} --`}</option>
        {accounts.map((acc) => (
          <option key={acc.id} value={acc.id}>
            [{acc.code}] {acc.name}
          </option>
        ))}
      </select>
    </div>
  )
}