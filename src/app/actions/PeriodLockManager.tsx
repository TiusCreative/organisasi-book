"use client"

import { useState, useEffect } from "react"
import { getPeriodLocks, lockPeriod } from "@/app/actions/period-lock"
import { Lock, Unlock, AlertTriangle } from "lucide-react"

export default function PeriodLockManager() {
  const [locks, setLocks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadData = async () => {
    setLoading(true)
    const res = await getPeriodLocks()
    if (res.success) setLocks(res.locks || [])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleLock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!confirm("Tutup buku akan mengunci semua transaksi di bulan ini. Lanjutkan?")) return
    
    setIsSubmitting(true)
    const formData = new FormData(e.target as HTMLFormElement)
    const res = await lockPeriod(formData)
    if (res.success) {
      alert("Periode berhasil dikunci!")
      ;(e.target as HTMLFormElement).reset()
      loadData()
    } else {
      alert(res.error)
    }
    setIsSubmitting(false)
  }

  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni", 
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ]

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Tutup Buku (Period Lock)</h2>
          <p className="text-sm text-slate-500">Kunci data jurnal agar tidak bisa diubah setelah pelaporan.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 rounded-xl border border-slate-200 bg-white p-5 h-fit shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Lock size={18} className="text-rose-600" /> Form Tutup Buku
          </h3>
          <form onSubmit={handleLock} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tahun</label>
              <input type="number" name="year" required defaultValue={new Date().getFullYear()} className="w-full rounded-lg border border-slate-300 p-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Bulan</label>
              <select name="month" required defaultValue={new Date().getMonth()} className="w-full rounded-lg border border-slate-300 p-2.5 text-sm">
                {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Catatan / Alasan</label>
              <input type="text" name="reason" placeholder="Contoh: Closing Q1" className="w-full rounded-lg border border-slate-300 p-2.5 text-sm" />
            </div>
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-start gap-2 text-sm text-amber-800">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <p>Transaksi di periode terkunci akan ditolak oleh sistem <i>Ledger</i>.</p>
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full bg-rose-600 text-white font-bold py-2.5 rounded-lg hover:bg-rose-700 disabled:opacity-50">
              {isSubmitting ? "Memproses..." : "Kunci Periode"}
            </button>
          </form>
        </div>

        <div className="md:col-span-2 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-bold">Periode</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold">Dikunci Oleh</th>
                <th className="px-4 py-3 font-bold">Tanggal Kunci</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {locks.map((lock) => (
                <tr key={lock.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold text-slate-800">{months[lock.month - 1]} {lock.year}</td>
                  <td className="px-4 py-3">
                    <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded-full text-xs font-bold flex items-center w-fit gap-1"><Lock size={12} /> TERKUNCI</span>
                  </td>
                  <td className="px-4 py-3">{lock.lockedByName}</td>
                  <td className="px-4 py-3">{new Date(lock.lockedAt).toLocaleString("id-ID")}</td>
                </tr>
              ))}
              {locks.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Belum ada periode yang dikunci.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}