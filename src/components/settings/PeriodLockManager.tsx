"use client"

import { useState, useEffect } from "react"
import { Lock, Unlock, Calendar, AlertCircle } from "lucide-react"
import { getPeriodLocks, lockPeriod } from "../../app/actions/period-lock"

interface PeriodLock {
  id: string
  year: number
  month: number | null
  lockType: string
  lockedAt: Date
  lockedBy: string
  lockedByName?: string
  reason?: string
  isLocked: boolean
  unlockedAt?: Date
  unlockedBy?: string
  unlockedByName?: string
  unlockReason?: string
}

export default function PeriodLockManager() {
  const [locks, setLocks] = useState<PeriodLock[]>([])
  const [loading, setLoading] = useState(true)
  const [showLockForm, setShowLockForm] = useState(false)
  const [lockForm, setLockForm] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    lockType: "PERIOD",
    reason: "",
  })

  useEffect(() => {
    loadLocks()
  }, [])

  const loadLocks = async () => {
    const result = await getPeriodLocks()
    if (result.success) {
      setLocks(result.locks)
    }
    setLoading(false)
  }

  const handleLock = async (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData()
    formData.append("year", lockForm.year.toString())
    if (lockForm.lockType === "PERIOD") {
      formData.append("month", lockForm.month.toString())
    }
    formData.append("lockType", lockForm.lockType)
    formData.append("reason", lockForm.reason)

    const result = await lockPeriod(formData)
    if (result.success) {
      setShowLockForm(false)
      loadLocks()
    } else {
      alert(result.error || "Gagal mengunci period")
    }
  }

  const handleUnlock = async (lock: PeriodLock) => {
    // Unlock functionality not yet implemented in period-lock.ts
    alert("Fitur unlock period belum tersedia. Silakan hubungi admin.")
    return
    /*
    if (!confirm(`Apakah Anda yakin ingin membuka period ${lock.year}-${lock.month || "FULL"}?`)) {
      return
    }

    const reason = prompt("Alasan membuka period (opsional):")
    const formData = new FormData()
    formData.append("year", lock.year.toString())
    if (lock.month) {
      formData.append("month", lock.month.toString())
    }
    if (reason) {
      formData.append("unlockReason", reason)
    }

    const result = await unlockPeriodAction(formData)
    if (result.success) {
      loadLocks()
    } else {
      alert(result.error || "Gagal membuka period")
    }
  }

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Lock size={20} className="text-amber-600" />
          <div>
            <h3 className="text-lg font-bold text-slate-800">Tutup Buku / Lock Period</h3>
            <p className="text-sm text-slate-500">Kunci period untuk mencegah perubahan data</p>
          </div>
        </div>
        <button
          onClick={() => setShowLockForm(true)}
          className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700"
        >
          + Kunci Period
        </button>
      </div>

      {showLockForm && (
        <form onSubmit={handleLock} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipe Lock</label>
              <select
                value={lockForm.lockType}
                onChange={(e) => setLockForm({ ...lockForm, lockType: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="PERIOD">Per Bulan</option>
                <option value="YEAR">Per Tahun</option>
                <option value="FULL">Full (Semua Period)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tahun</label>
              <input
                type="number"
                value={lockForm.year}
                onChange={(e) => setLockForm({ ...lockForm, year: parseInt(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                min="2020"
                max="2030"
              />
            </div>
            {lockForm.lockType === "PERIOD" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Bulan</label>
                <select
                  value={lockForm.month}
                  onChange={(e) => setLockForm({ ...lockForm, month: parseInt(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(2024, i).toLocaleDateString("id-ID", { month: "long" })}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Alasan (opsional)</label>
            <input
              type="text"
              value={lockForm.reason}
              onChange={(e) => setLockForm({ ...lockForm, reason: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Contoh: Tutup buku akhir tahun"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700"
            >
              Kunci Period
            </button>
            <button
              type="button"
              onClick={() => setShowLockForm(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
            >
              Batal
            </button>
          </div>
        </form>
      )}

      {locks.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
          <Calendar size={40} className="mx-auto mb-2 opacity-50" />
          <p>Belum ada period yang dikunci</p>
        </div>
      ) : (
        <div className="space-y-2">
          {locks.map((lock) => (
            <div
              key={lock.id}
              className={`rounded-xl border p-4 ${
                lock.isLocked
                  ? "border-red-200 bg-red-50"
                  : "border-green-200 bg-green-50"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {lock.isLocked ? (
                    <Lock size={20} className="text-red-600 mt-0.5" />
                  ) : (
                    <Unlock size={20} className="text-green-600 mt-0.5" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">
                        {lock.year}
                        {lock.month && ` - ${new Date(lock.year, lock.month - 1).toLocaleDateString("id-ID", { month: "long" })}`}
                      </span>
                      <span className="rounded-full px-2 py-0.5 text-xs font-bold uppercase">
                        {lock.lockType}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          lock.isLocked ? "bg-red-200 text-red-800" : "bg-green-200 text-green-800"
                        }`}
                      >
                        {lock.isLocked ? "TERKUNCI" : "TERBUKA"}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      <p>Dikunci oleh: {lock.lockedByName || lock.lockedBy}</p>
                      <p>Tanggal: {new Date(lock.lockedAt).toLocaleDateString("id-ID")}</p>
                      {lock.reason && <p>Alasan: {lock.reason}</p>}
                      {!lock.isLocked && lock.unlockedByName && (
                        <p>Dibuka oleh: {lock.unlockedByName} pada {new Date(lock.unlockedAt!).toLocaleDateString("id-ID")}</p>
                      )}
                    </div>
                  </div>
                </div>
                {lock.isLocked && (
                  <button
                    onClick={() => handleUnlock(lock)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-slate-100"
                  >
                    Buka
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
        <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-bold">Peringatan:</p>
          <p>Period yang dikunci tidak dapat diubah. Transaksi, pembayaran, dan perubahan data pada period tersebut akan dicegah.</p>
        </div>
      </div>
    </div>
  )
}
