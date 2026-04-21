import { Landmark, LineChart, Wallet } from "lucide-react"
import { prisma } from "../../lib/prisma"
import InvestmentModal from "../../components/forms/InvestmentModal"
import EditInvestmentModal from "../../components/forms/EditInvestmentModal"
import InkasoInvestmentModal from "../../components/forms/InkasoInvestmentModal"
import DeleteInvestmentButton from "../../components/DeleteInvestmentButton"
import { requireModuleAccess } from "../../lib/auth"

export default async function InvestasiPage() {
  const { organization: activeOrg } = await requireModuleAccess("investments")

  if (!activeOrg) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-0">
        <h1 className="text-2xl font-bold text-slate-800">Investasi</h1>
        <p className="text-slate-500 mt-2">Belum ada organisasi. Silakan buat organisasi terlebih dahulu.</p>
      </div>
    )
  }

  const [investments, bankAccounts, adjustmentAccounts] = await Promise.all([
    prisma.investment.findMany({
      where: { organizationId: activeOrg.id },
      include: {
        account: true,
        sourceBankAccount: true,
        settlementBankAccount: true,
      },
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
    }),
    prisma.bankAccount.findMany({
      where: { organizationId: activeOrg.id },
      orderBy: [{ bankName: "asc" }],
    }),
    prisma.chartOfAccount.findMany({
      where: {
        organizationId: activeOrg.id,
        type: {
          in: ["Revenue", "Expense"],
        },
      },
      orderBy: [{ code: "asc" }],
    }),
  ])

  const totalPurchase = investments.reduce((sum, investment) => sum + investment.purchaseAmount, 0)
  const totalCurrent = investments.reduce((sum, investment) => sum + investment.currentValue, 0)
  const activeCount = investments.filter((investment) => investment.status !== "LIQUIDATED").length

  return (
    <div className="max-w-full lg:max-w-6xl mx-auto px-4 sm:px-0 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Deposito, Saham & Investasi</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola portofolio investasi dan posting inkaso otomatis ke laporan bank.</p>
        </div>
        <InvestmentModal organizationId={activeOrg.id} bankAccounts={bankAccounts} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-500">Jumlah Investasi</p>
            <Wallet className="text-blue-600" size={20} />
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-800">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-500">Nilai Perolehan</p>
            <Landmark className="text-emerald-600" size={20} />
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-800">Rp {totalPurchase.toLocaleString("id-ID")}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-500">Nilai Buku Saat Ini</p>
            <LineChart className="text-amber-600" size={20} />
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-800">Rp {totalCurrent.toLocaleString("id-ID")}</p>
        </div>
      </div>

      <div className="space-y-4">
        {investments.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white py-16 text-center shadow-sm">
            <p className="text-lg font-bold text-slate-700">Belum ada investasi</p>
            <p className="mt-2 text-sm text-slate-500">Tambahkan deposito, saham, atau investasi lainnya untuk mulai memantau portofolio.</p>
          </div>
        ) : (
          investments.map((investment) => (
            <div key={investment.id} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-800">{investment.name}</h2>
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{investment.type.replaceAll("_", " ")}</span>
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${investment.status === "LIQUIDATED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      {investment.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{investment.institution} • Akun {investment.account.code} - {investment.account.name}</p>
                  <p className="mt-3 text-sm text-slate-600">
                    Mulai {new Date(investment.startDate).toLocaleDateString("id-ID")}
                    {investment.maturityDate ? ` • Jatuh tempo ${new Date(investment.maturityDate).toLocaleDateString("id-ID")}` : ""}
                  </p>
                  {investment.notes && <p className="mt-2 text-sm text-slate-500">{investment.notes}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4 lg:min-w-[340px]">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Perolehan</p>
                    <p className="mt-1 font-bold text-slate-800">Rp {investment.purchaseAmount.toLocaleString("id-ID")}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Nilai Buku</p>
                    <p className="mt-1 font-bold text-slate-800">Rp {investment.currentValue.toLocaleString("id-ID")}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Estimasi Hasil</p>
                    <p className="mt-1 font-bold text-emerald-700">Rp {(investment.expectedReturn || 0).toLocaleString("id-ID")}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Bank Sumber</p>
                    <p className="mt-1 font-bold text-slate-800">{investment.sourceBankAccount?.bankName || "-"}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-4">
                <EditInvestmentModal investment={investment} bankAccounts={bankAccounts} />
                <InkasoInvestmentModal investment={investment} bankAccounts={bankAccounts} adjustmentAccounts={adjustmentAccounts} />
                <DeleteInvestmentButton investmentId={investment.id} />
                {investment.settlementBankAccount && (
                  <span className="text-xs text-slate-500">Inkaso ke {investment.settlementBankAccount.bankName}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
