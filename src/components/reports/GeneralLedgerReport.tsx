"use client"

import { useEffect, useState } from "react"

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount || 0)
}

type LedgerEntry = {
  id: string
  date: string
  accountCode: string
  accountName: string
  description: string
  debit: number
  credit: number
  balance: number
}

type AccountLedger = {
  accountCode: string
  accountName: string
  accountType: string
  openingBalance: number
  entries: LedgerEntry[]
  closingBalance: number
  totalDebit: number
  totalCredit: number
}

export default function GeneralLedgerReport(props: { initialStartDate?: string; initialEndDate?: string }) {
  const [startDate, setStartDate] = useState(props.initialStartDate || new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0])
  const [endDate, setEndDate] = useState(props.initialEndDate || new Date().toISOString().split("T")[0])
  const [data, setData] = useState<AccountLedger[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      // TODO: Fetch from actual API when implemented
      // For now, showing demo data
      const demoData: AccountLedger[] = [
        {
          accountCode: "1-1001",
          accountName: "Kas",
          accountType: "ASSET",
          openingBalance: 5000000000,
          entries: [
            { id: "1", date: "2024-04-01", accountCode: "1-1001", accountName: "Kas", description: "Setoran modal", debit: 1000000000, credit: 0, balance: 6000000000 },
            { id: "2", date: "2024-04-05", accountCode: "1-1001", accountName: "Kas", description: "Pembayaran supplier", debit: 0, credit: 2000000000, balance: 4000000000 },
            { id: "3", date: "2024-04-10", accountCode: "1-1001", accountName: "Kas", description: "Penerimaan dari pelanggan", debit: 3000000000, credit: 0, balance: 7000000000 },
          ],
          closingBalance: 7000000000,
          totalDebit: 4000000000,
          totalCredit: 2000000000,
        },
        {
          accountCode: "1-1002",
          accountName: "Bank BCA",
          accountType: "ASSET",
          openingBalance: 10000000000,
          entries: [
            { id: "4", date: "2024-04-02", accountCode: "1-1002", accountName: "Bank BCA", description: "Transfer masuk", debit: 5000000000, credit: 0, balance: 15000000000 },
            { id: "5", date: "2024-04-08", accountCode: "1-1002", accountName: "Bank BCA", description: "Pembayaran gaji", debit: 0, credit: 3000000000, balance: 12000000000 },
          ],
          closingBalance: 12000000000,
          totalDebit: 5000000000,
          totalCredit: 3000000000,
        },
        {
          accountCode: "2-1001",
          accountName: "Piutang Usaha",
          accountType: "ASSET",
          openingBalance: 3000000000,
          entries: [
            { id: "6", date: "2024-04-03", accountCode: "2-1001", accountName: "Piutang Usaha", description: "Penjualan kredit", debit: 2000000000, credit: 0, balance: 5000000000 },
            { id: "7", date: "2024-04-15", accountCode: "2-1001", accountName: "Piutang Usaha", description: "Pembayaran pelanggan", debit: 0, credit: 1500000000, balance: 3500000000 },
          ],
          closingBalance: 3500000000,
          totalDebit: 2000000000,
          totalCredit: 1500000000,
        },
      ]

      setData(demoData)
    } catch (e) {
      setData([])
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
      ) : data.length > 0 ? (
        <div className="space-y-6">
          {data.map((account) => (
            <div key={account.accountCode} className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <div className="p-4 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900">{account.accountCode} - {account.accountName}</h3>
                    <p className="text-xs text-slate-500 mt-1">Tipe: {account.accountType}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-slate-600">Saldo Akhir</div>
                    <div className="text-lg font-bold text-slate-900">{formatCurrency(account.closingBalance)}</div>
                  </div>
                </div>
              </div>
              <table className="min-w-[700px] w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-slate-700">
                    <th className="px-4 py-3 font-bold">Tanggal</th>
                    <th className="px-4 py-3 font-bold">Deskripsi</th>
                    <th className="px-4 py-3 font-bold text-right">Debit</th>
                    <th className="px-4 py-3 font-bold text-right">Kredit</th>
                    <th className="px-4 py-3 font-bold text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-200 bg-slate-100">
                    <td className="px-4 py-3 text-slate-600" colSpan={4}>Saldo Awal</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(account.openingBalance)}</td>
                  </tr>
                  {account.entries.map((entry) => (
                    <tr key={entry.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-slate-600">{new Date(entry.date).toLocaleDateString('id-ID')}</td>
                      <td className="px-4 py-3 text-slate-800">{entry.description}</td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-600">{entry.debit > 0 ? formatCurrency(entry.debit) : '-'}</td>
                      <td className="px-4 py-3 text-right font-mono text-rose-600">{entry.credit > 0 ? formatCurrency(entry.credit) : '-'}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold">{formatCurrency(entry.balance)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold">
                    <td className="px-4 py-3" colSpan={2}>Total Periode</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-600">{formatCurrency(account.totalDebit)}</td>
                    <td className="px-4 py-3 text-right font-mono text-rose-600">{formatCurrency(account.totalCredit)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(account.closingBalance)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="text-sm text-amber-900">Belum ada data buku besar untuk periode ini.</p>
        </div>
      )}
    </div>
  )
}
