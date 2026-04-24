Bagaimana jika saya ingin menambahkan sistem persetujuan (approval) sebelum Kas Keluar / Pengeluaran dicairkan?"use client"

import { useState, useEffect } from "react"
import { getChartOfAccounts, createDirectExpense, getJournals } from "@/app/actions/accounting"
import { Plus, Wallet, FileText } from "lucide-react"

export default function DirectExpenseManager() {
  const [accounts, setAccounts] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadData = async () => {
    setLoading(true)
    const [accRes, expRes] = await Promise.all([
      getChartOfAccounts(),
      // Ambil jurnal pengeluaran yg dicatat dari form ini (prefix EXP-)
      getJournals() 
    ])
    
    if (accRes.success) setAccounts(accRes.accounts)
    if (expRes.success) {
      // Filter manual di client: Hanya yg ber-prefix "EXP-"
      const filtered = (expRes.journals as any[]).filter(j => j.reference?.startsWith("EXP-"))
      setExpenses(filtered)
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    const formData = new FormData(e.target as HTMLFormElement)
    const res = await createDirectExpense(formData)
    
    if (res.success) {
      alert("Pengeluaran kas berhasil dicatat dan masuk ke jurnal!")
      setShowModal(false)
      loadData()
    } else {
      alert(res.error)
    }
    setIsSubmitting(false)
  }

  const formatCurrency = (val: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(val)

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Kas Keluar / Pengeluaran</h2>
          <p className="text-sm text-slate-500">Mencatat pengeluaran uang operasional atau komisi secara manual.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700">
          <Plus size={16} /> Catat Kas Keluar
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-slate-500">Loading data...</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-bold">Tanggal</th>
                <th className="px-4 py-3 font-bold">Referensi</th>
                <th className="px-4 py-3 font-bold">Keterangan</th>
                <th className="px-4 py-3 font-bold">Akun Beban (Debet)</th>
                <th className="px-4 py-3 font-bold">Akun Kas (Kredit)</th>
                <th className="px-4 py-3 font-bold text-right">Nominal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.map((exp: any) => {
                // Ambil line debit dan kredit
                const debitLine = exp.lines.find((l:any) => l.debit > 0)
                const creditLine = exp.lines.find((l:any) => l.credit > 0)
                return (
                  <tr key={exp.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{new Date(exp.date).toLocaleDateString("id-ID")}</td>
                    <td className="px-4 py-3 text-slate-500">{exp.reference}</td>
                    <td className="px-4 py-3">{exp.description}</td>
                    <td className="px-4 py-3"><span className="bg-slate-100 px-2 py-1 rounded text-xs">{debitLine?.account?.name || "-"}</span></td>
                    <td className="px-4 py-3"><span className="bg-slate-100 px-2 py-1 rounded text-xs">{creditLine?.account?.name || "-"}</span></td>
                    <td className="px-4 py-3 font-bold text-rose-600 text-right">{formatCurrency(debitLine?.debit || 0)}</td>
                  </tr>
                )
              })}
              {expenses.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Belum ada catatan pengeluaran kas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Tambah Pengeluaran */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Wallet size={18} className="text-rose-600" /> Catat Kas Keluar (Expense)</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tanggal Pengeluaran</label>
                <input type="date" name="date" required defaultValue={new Date().toISOString().split("T")[0]} className="w-full border rounded-lg p-2.5 text-sm focus:outline-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Pilih Akun Sumber Uang (Kas/Bank) - Kredit</label>
                <select name="creditAccountId" required className="w-full border rounded-lg p-2.5 text-sm focus:outline-blue-500">
                  <option value="">Pilih Kas/Bank...</option>
                  {accounts.filter(a => a.type === "Asset").map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Pilih Akun Tujuan/Beban - Debet</label>
                <select name="debitAccountId" required className="w-full border rounded-lg p-2.5 text-sm focus:outline-blue-500">
                  <option value="">Pilih Beban Pengeluaran...</option>
                  {/* Menampilkan akun Beban, atau Kewajiban (kalo bayar cicilan) */}
                  {accounts.filter(a => ["Expense", "Liability"].includes(a.type)).map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Keterangan / Tujuan</label>
                <textarea name="description" required rows={2} placeholder="Contoh: Pembayaran Komisi Manual Sales Budi" className="w-full border rounded-lg p-2.5 text-sm focus:outline-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nominal (Rp)</label>
                <input type="number" name="amount" required min="1" placeholder="Contoh: 500000" className="w-full border rounded-lg p-2.5 text-sm focus:outline-blue-500" />
              </div>
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-lg font-bold hover:bg-slate-200">Batal</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 bg-rose-600 text-white py-2 rounded-lg font-bold hover:bg-rose-700 disabled:opacity-50">
                  {isSubmitting ? "Menyimpan..." : "Simpan Pengeluaran"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}