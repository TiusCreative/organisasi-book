"use client"

import { useEffect, useState } from "react"

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount || 0)
}

type Entity = {
  id: string
  name: string
  type: "parent" | "subsidiary"
  ownershipPercentage: number
}

type ConsolidatedBalanceSheet = {
  parentAssets: number
  subsidiariesAssets: number
  consolidatedAssets: number
  parentLiabilities: number
  subsidiariesLiabilities: number
  consolidatedLiabilities: number
  parentEquity: number
  subsidiariesEquity: number
  consolidatedEquity: number
  nonControllingInterest: number
}

type ConsolidatedIncomeStatement = {
  parentRevenue: number
  subsidiariesRevenue: number
  consolidatedRevenue: number
  parentExpenses: number
  subsidiariesExpenses: number
  consolidatedExpenses: number
  parentNetIncome: number
  subsidiariesNetIncome: number
  consolidatedNetIncome: number
  intercompanyEliminations: number
}

type IntercompanyTransaction = {
  id: string
  description: string
  amount: number
  type: "receivable" | "payable" | "revenue" | "expense"
  fromEntity: string
  toEntity: string
}

export default function ConsolidatedFinancialStatements(props: { initialStartDate?: string; initialEndDate?: string }) {
  const [startDate, setStartDate] = useState(props.initialStartDate || new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0])
  const [endDate, setEndDate] = useState(props.initialEndDate || new Date().toISOString().split("T")[0])
  const [entities, setEntities] = useState<Entity[]>([])
  const [balanceSheet, setBalanceSheet] = useState<ConsolidatedBalanceSheet | null>(null)
  const [incomeStatement, setIncomeStatement] = useState<ConsolidatedIncomeStatement | null>(null)
  const [intercompanyTransactions, setIntercompanyTransactions] = useState<IntercompanyTransaction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      // TODO: Fetch from actual API when implemented
      // For now, showing demo data
      const demoEntities: Entity[] = [
        { id: "1", name: "PT Parent Company", type: "parent", ownershipPercentage: 100 },
        { id: "2", name: "PT Subsidiary A", type: "subsidiary", ownershipPercentage: 80 },
        { id: "3", name: "CV Subsidiary B", type: "subsidiary", ownershipPercentage: 60 }
      ]

      const demoBalanceSheet: ConsolidatedBalanceSheet = {
        parentAssets: 15000000000,
        subsidiariesAssets: 8000000000,
        consolidatedAssets: 23000000000,
        parentLiabilities: 8000000000,
        subsidiariesLiabilities: 4000000000,
        consolidatedLiabilities: 12000000000,
        parentEquity: 7000000000,
        subsidiariesEquity: 4000000000,
        consolidatedEquity: 11000000000,
        nonControllingInterest: 1600000000
      }

      const demoIncomeStatement: ConsolidatedIncomeStatement = {
        parentRevenue: 25000000000,
        subsidiariesRevenue: 12000000000,
        consolidatedRevenue: 37000000000,
        parentExpenses: 18000000000,
        subsidiariesExpenses: 9000000000,
        consolidatedExpenses: 27000000000,
        parentNetIncome: 7000000000,
        subsidiariesNetIncome: 3000000000,
        consolidatedNetIncome: 10000000000,
        intercompanyEliminations: 500000000
      }

      const demoIntercompany: IntercompanyTransaction[] = [
        { id: "1", description: "Intercompany Sales", amount: 2000000000, type: "revenue", fromEntity: "PT Parent Company", toEntity: "PT Subsidiary A" },
        { id: "2", description: "Intercompany Loans", amount: 1500000000, type: "receivable", fromEntity: "PT Parent Company", toEntity: "CV Subsidiary B" },
        { id: "3", description: "Management Fees", amount: 500000000, type: "expense", fromEntity: "PT Subsidiary A", toEntity: "PT Parent Company" }
      ]

      setEntities(demoEntities)
      setBalanceSheet(demoBalanceSheet)
      setIncomeStatement(demoIncomeStatement)
      setIntercompanyTransactions(demoIntercompany)
    } catch (e) {
      setEntities([])
      setBalanceSheet(null)
      setIncomeStatement(null)
      setIntercompanyTransactions([])
      setError(e instanceof Error ? e.message : "Gagal memuat laporan")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate])

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Mulai</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Akhir</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <button onClick={load} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">
          Tampilkan
        </button>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {loading ? (
        <div className="py-12 text-center text-slate-500">Loading...</div>
      ) : entities.length > 0 ? (
        <div className="space-y-6">
          {/* Entities Overview */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="font-bold text-slate-900 mb-3">Entitas dalam Konsolidasi</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {entities.map((entity) => (
                <div key={entity.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-sm font-medium text-slate-800">{entity.name}</div>
                  <div className="text-xs text-slate-600 mt-1">
                    {entity.type === "parent" ? "Parent Company" : "Subsidiary"} - {entity.ownershipPercentage}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* IFRS 10 Information */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <strong>IFRS 10 Consolidated Financial Statements:</strong> Laporan ini mengikuti standar IFRS 10 untuk penyajian laporan keuangan konsolidasi, termasuk eliminasi transaksi intercompany dan pengakuan non-controlling interest.
          </div>

          {/* Consolidated Balance Sheet */}
          {balanceSheet && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <div className="p-4 border-b border-slate-200 bg-slate-50">
                <h3 className="font-bold text-slate-900">Neraca Konsolidasi</h3>
              </div>
              <table className="min-w-[800px] w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-slate-700">
                    <th className="px-4 py-3 font-bold">Akun</th>
                    <th className="px-4 py-3 font-bold text-right">Parent</th>
                    <th className="px-4 py-3 font-bold text-right">Subsidiaries</th>
                    <th className="px-4 py-3 font-bold text-right">Konsolidasi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-100 bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-900" colSpan={4}>Aset</td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-800">Total Aset</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(balanceSheet.parentAssets)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(balanceSheet.subsidiariesAssets)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold">{formatCurrency(balanceSheet.consolidatedAssets)}</td>
                  </tr>
                  <tr className="border-t border-slate-100 bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-900" colSpan={4}>Liabilitas</td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-800">Total Liabilitas</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(balanceSheet.parentLiabilities)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(balanceSheet.subsidiariesLiabilities)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold">{formatCurrency(balanceSheet.consolidatedLiabilities)}</td>
                  </tr>
                  <tr className="border-t border-slate-100 bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-900" colSpan={4}>Ekuitas</td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-800">Ekuitas Parent</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(balanceSheet.parentEquity)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(balanceSheet.subsidiariesEquity)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(balanceSheet.consolidatedEquity)}</td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-800">Non-Controlling Interest</td>
                    <td className="px-4 py-3 text-right font-mono">-</td>
                    <td className="px-4 py-3 text-right font-mono">-</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(balanceSheet.nonControllingInterest)}</td>
                  </tr>
                  <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                    <td className="px-4 py-3">Total Ekuitas</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(balanceSheet.parentEquity)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(balanceSheet.subsidiariesEquity)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(balanceSheet.consolidatedEquity + balanceSheet.nonControllingInterest)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Consolidated Income Statement */}
          {incomeStatement && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <div className="p-4 border-b border-slate-200 bg-slate-50">
                <h3 className="font-bold text-slate-900">Laba Rugi Konsolidasi</h3>
              </div>
              <table className="min-w-[800px] w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-slate-700">
                    <th className="px-4 py-3 font-bold">Akun</th>
                    <th className="px-4 py-3 font-bold text-right">Parent</th>
                    <th className="px-4 py-3 font-bold text-right">Subsidiaries</th>
                    <th className="px-4 py-3 font-bold text-right">Konsolidasi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-800">Pendapatan</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(incomeStatement.parentRevenue)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(incomeStatement.subsidiariesRevenue)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold">{formatCurrency(incomeStatement.consolidatedRevenue)}</td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-800">Beban</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(incomeStatement.parentExpenses)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(incomeStatement.subsidiariesExpenses)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(incomeStatement.consolidatedExpenses)}</td>
                  </tr>
                  <tr className="border-t border-slate-100 bg-amber-50">
                    <td className="px-4 py-3 text-slate-800">Eliminasi Intercompany</td>
                    <td className="px-4 py-3 text-right font-mono">-</td>
                    <td className="px-4 py-3 text-right font-mono">-</td>
                    <td className="px-4 py-3 text-right font-mono text-amber-700">({formatCurrency(incomeStatement.intercompanyEliminations)})</td>
                  </tr>
                  <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                    <td className="px-4 py-3">Laba/(Rugi) Bersih</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(incomeStatement.parentNetIncome)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(incomeStatement.subsidiariesNetIncome)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(incomeStatement.consolidatedNetIncome)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Intercompany Transactions */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-900">Transaksi Intercompany (Perlu Dihilangkan)</h3>
            </div>
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-700">
                  <th className="px-4 py-3 font-bold">Deskripsi</th>
                  <th className="px-4 py-3 font-bold">Dari Entitas</th>
                  <th className="px-4 py-3 font-bold">Ke Entitas</th>
                  <th className="px-4 py-3 font-bold">Tipe</th>
                  <th className="px-4 py-3 font-bold text-right">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {intercompanyTransactions.map((tx) => (
                  <tr key={tx.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-800">{tx.description}</td>
                    <td className="px-4 py-3 text-slate-600">{tx.fromEntity}</td>
                    <td className="px-4 py-3 text-slate-600">{tx.toEntity}</td>
                    <td className="px-4 py-3 text-slate-600 capitalize">{tx.type}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(tx.amount)}</td>
                  </tr>
                ))}
                {intercompanyTransactions.length === 0 && (
                  <tr>
                    <td className="px-4 py-3 text-slate-600" colSpan={5}>Tidak ada transaksi intercompany</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="text-sm text-amber-900">Belum ada data konsolidasi untuk periode ini.</p>
        </div>
      )}
    </div>
  )
}
