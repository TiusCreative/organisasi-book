"use client"

import { useState, useEffect } from "react"
import { getPayrollData, createDraftSalarySlip, paySalarySlip } from "@/app/actions/hr"
import { Plus, Wallet, FileText } from "lucide-react"

export default function PayrollManager() {
  const [data, setData] = useState<any>({ employees: [], slips: [], accounts: [] })
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showPayModal, setShowPayModal] = useState<string | null>(null) // isinya slipId

  const [payForm, setPayForm] = useState({ cashAccountId: "", expenseAccountId: "" })

  const loadData = async () => {
    setLoading(true)
    const res = await getPayrollData()
    if (res.success) setData(res)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData(e.target as HTMLFormElement)
    const res = await createDraftSalarySlip(formData)
    if (res.success) {
      alert("Draft Slip Gaji berhasil dibuat.")
      setShowCreateModal(false)
      loadData()
    } else {
      alert(res.error)
    }
  }

  const handlePay = async () => {
    if (!showPayModal || !payForm.cashAccountId || !payForm.expenseAccountId) return alert("Pilih akun Kas dan Beban!")
    const res = await paySalarySlip(showPayModal, payForm.cashAccountId, payForm.expenseAccountId)
    if (res.success) {
      alert("Gaji berhasil dibayar dan jurnal otomatis telah dicatat!")
      setShowPayModal(null)
      loadData()
    } else {
      alert(res.error)
    }
  }

  const formatCurrency = (val: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(val)

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Payroll & Penggajian</h2>
          <p className="text-sm text-slate-500">Kelola slip gaji karyawan dan otomasi jurnal pembayaran.</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">
          <Plus size={16} /> Buat Slip Gaji
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-slate-500">Loading data...</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-bold">Karyawan</th>
                <th className="px-4 py-3 font-bold">Periode</th>
                <th className="px-4 py-3 font-bold">Gaji Pokok</th>
                <th className="px-4 py-3 font-bold">Gaji Bersih (Net)</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.slips.map((slip: any) => (
                <tr key={slip.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-800">{slip.employee?.name}</td>
                  <td className="px-4 py-3">{slip.month} / {slip.year}</td>
                  <td className="px-4 py-3">{formatCurrency(slip.baseSalary)}</td>
                  <td className="px-4 py-3 font-bold text-emerald-700">{formatCurrency(slip.netIncome)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${slip.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'}`}>{slip.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    {slip.status === 'DRAFT' && (
                      <button onClick={() => setShowPayModal(slip.id)} className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1">
                        <Wallet size={14} /> Bayar & Jurnal
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><FileText size={18} /> Buat Draft Slip Gaji</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">Pilih Karyawan</label>
                <select name="employeeId" required className="w-full border rounded-lg p-2.5 text-sm">
                  {data.employees.map((e: any) => <option key={e.id} value={e.id}>{e.name} - {formatCurrency(e.baseSalary)}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Bulan (1-12)</label><input type="number" name="month" required min="1" max="12" defaultValue={new Date().getMonth() + 1} className="w-full border rounded-lg p-2.5 text-sm" /></div>
                <div><label className="block text-sm font-medium mb-1">Tahun</label><input type="number" name="year" required defaultValue={new Date().getFullYear()} className="w-full border rounded-lg p-2.5 text-sm" /></div>
              </div>
              <div><label className="block text-sm font-medium mb-1">Total Tunjangan Tambahan</label><input type="number" name="allowance" defaultValue="0" className="w-full border rounded-lg p-2.5 text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">Total Potongan (Telat/Pinjaman)</label><input type="number" name="deduction" defaultValue="0" className="w-full border rounded-lg p-2.5 text-sm" /></div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-lg font-bold">Batal</button>
                <button type="submit" className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700">Buat Draft</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-bold text-lg mb-4">Konfirmasi Pembayaran Gaji</h3>
            <p className="text-sm text-slate-500 mb-4">Sistem akan secara otomatis membuatkan Jurnal Akuntansi berdasarkan pilihan akun di bawah ini.</p>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">Akun Beban (Debit)</label><select value={payForm.expenseAccountId} onChange={e => setPayForm({...payForm, expenseAccountId: e.target.value})} className="w-full border rounded-lg p-2.5 text-sm"><option value="">Pilih Akun Beban Gaji...</option>{data.accounts.filter((a:any)=>a.type==="Expense").map((a:any) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}</select></div>
              <div><label className="block text-sm font-medium mb-1">Akun Sumber Dana Kas (Kredit)</label><select value={payForm.cashAccountId} onChange={e => setPayForm({...payForm, cashAccountId: e.target.value})} className="w-full border rounded-lg p-2.5 text-sm"><option value="">Pilih Kas/Bank...</option>{data.accounts.filter((a:any)=>a.type==="Asset").map((a:any) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}</select></div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowPayModal(null)} className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-lg font-bold">Batal</button>
                <button onClick={handlePay} className="flex-1 bg-emerald-600 text-white py-2 rounded-lg font-bold hover:bg-emerald-700">Bayar & Posting Jurnal</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}