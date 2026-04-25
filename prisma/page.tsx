import { getCoaMapping } from "@/app/actions/accounting-settings"
import { getChartOfAccounts } from "@/app/actions/accounting"
import AccountingConfigForm from "@/components/accounting/AccountingConfigForm"

export const metadata = {
  title: "Pengaturan Akuntansi | Organisasi Book",
}

export default async function AccountingSettingsPage() {
  // Eksekusi pemanggilan database secara paralel
  const [configResult, accountsResult] = await Promise.all([
    getCoaMapping(),
    getChartOfAccounts()
  ])

  if (!accountsResult.success) {
    return (
      <div className="p-8 text-center text-red-500">
        Gagal memuat Chart of Accounts. Pastikan database aktif.
      </div>
    )
  }

  const accounts = accountsResult.accounts || []
  const config = configResult.data || null

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Pemetaan Akun Default (COA Mapping)</h1>
        <p className="mt-1 text-sm text-slate-500">Atur akun buku besar yang akan digunakan secara otomatis saat transaksi terjadi di modul operasional.</p>
      </div>

      <AccountingConfigForm initialConfig={config} accounts={accounts as any} />
    </div>
  )
}