"use client"

import { useEffect, useState } from "react"

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount || 0)
}

type Subsidiary = {
  id: string
  name: string
  acquisitionDate: string
  acquisitionCost: number
  fairValueAdjustment: number
  goodwill: number
  ownershipPercentage: number
}

type Acquisition = {
  id: string
  targetEntity: string
  acquisitionDate: string
  considerationTransferred: number
  netAssetsAcquired: number
  goodwill: number
  nonControllingInterest: number
}

export default function BusinessCombinationReport(props: { initialStartDate?: string; initialEndDate?: string }) {
  const [startDate, setStartDate] = useState(props.initialStartDate || new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0])
  const [endDate, setEndDate] = useState(props.initialEndDate || new Date().toISOString().split("T")[0])
  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>([])
  const [acquisitions, setAcquisitions] = useState<Acquisition[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      // TODO: Fetch from actual API when implemented
      // For now, showing demo data
      const demoSubsidiaries: Subsidiary[] = [
        {
          id: "1",
          name: "PT Subsidiary A",
          acquisitionDate: "2024-01-15",
          acquisitionCost: 5000000000,
          fairValueAdjustment: 200000000,
          goodwill: 300000000,
          ownershipPercentage: 80
        },
        {
          id: "2",
          name: "CV Subsidiary B",
          acquisitionDate: "2024-06-20",
          acquisitionCost: 2500000000,
          fairValueAdjustment: 100000000,
          goodwill: 150000000,
          ownershipPercentage: 60
        }
      ]
      
      const demoAcquisitions: Acquisition[] = [
        {
          id: "1",
          targetEntity: "PT Target Company",
          acquisitionDate: "2024-03-10",
          considerationTransferred: 8000000000,
          netAssetsAcquired: 6500000000,
          goodwill: 1500000000,
          nonControllingInterest: 1200000000
        }
      ]

      setSubsidiaries(demoSubsidiaries)
      setAcquisitions(demoAcquisitions)
    } catch (e) {
      setSubsidiaries([])
      setAcquisitions([])
      setError(e instanceof Error ? e.message : "Gagal memuat laporan")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate])

  const totalAcquisitionCost = subsidiaries.reduce((sum, s) => sum + s.acquisitionCost, 0)
  const totalGoodwill = subsidiaries.reduce((sum, s) => sum + s.goodwill, 0)
  const totalConsideration = acquisitions.reduce((sum, a) => sum + a.considerationTransferred, 0)

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
      ) : subsidiaries.length > 0 || acquisitions.length > 0 ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-sm text-slate-600">Total Biaya Akuisisi</div>
              <div className="text-xl font-bold text-slate-900">{formatCurrency(totalAcquisitionCost)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-sm text-slate-600">Total Goodwill</div>
              <div className="text-xl font-bold text-slate-900">{formatCurrency(totalGoodwill)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-sm text-slate-600">Total Consideration Transferred</div>
              <div className="text-xl font-bold text-slate-900">{formatCurrency(totalConsideration)}</div>
            </div>
          </div>

          {/* IFRS 3 Information */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <strong>IFRS 3 Business Combination:</strong> Laporan ini mengikuti standar IFRS 3 untuk pengakuan, pengukuran, dan pengungkapan kombinasi bisnis.
          </div>

          {/* Subsidiaries Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-700">
                  <th className="px-4 py-3 font-bold">Nama Subsidiari</th>
                  <th className="px-4 py-3 font-bold">Tanggal Akuisisi</th>
                  <th className="px-4 py-3 font-bold text-right">Biaya Akuisisi</th>
                  <th className="px-4 py-3 font-bold text-right">Penyesuaian Nilai Wajar</th>
                  <th className="px-4 py-3 font-bold text-right">Goodwill</th>
                  <th className="px-4 py-3 font-bold text-right">% Kepemilikan</th>
                </tr>
              </thead>
              <tbody>
                {subsidiaries.map((sub) => (
                  <tr key={sub.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-800">{sub.name}</td>
                    <td className="px-4 py-3 text-slate-600">{new Date(sub.acquisitionDate).toLocaleDateString('id-ID')}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(sub.acquisitionCost)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(sub.fairValueAdjustment)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(sub.goodwill)}</td>
                    <td className="px-4 py-3 text-right font-mono">{sub.ownershipPercentage}%</td>
                  </tr>
                ))}
                {subsidiaries.length === 0 && (
                  <tr>
                    <td className="px-4 py-3 text-slate-600" colSpan={6}>Tidak ada data subsidiari</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Acquisitions Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-700">
                  <th className="px-4 py-3 font-bold">Entitas Target</th>
                  <th className="px-4 py-3 font-bold">Tanggal Akuisisi</th>
                  <th className="px-4 py-3 font-bold text-right">Consideration Transferred</th>
                  <th className="px-4 py-3 font-bold text-right">Net Assets Acquired</th>
                  <th className="px-4 py-3 font-bold text-right">Goodwill</th>
                  <th className="px-4 py-3 font-bold text-right">Non-Controlling Interest</th>
                </tr>
              </thead>
              <tbody>
                {acquisitions.map((acq) => (
                  <tr key={acq.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-800">{acq.targetEntity}</td>
                    <td className="px-4 py-3 text-slate-600">{new Date(acq.acquisitionDate).toLocaleDateString('id-ID')}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(acq.considerationTransferred)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(acq.netAssetsAcquired)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(acq.goodwill)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(acq.nonControllingInterest)}</td>
                  </tr>
                ))}
                {acquisitions.length === 0 && (
                  <tr>
                    <td className="px-4 py-3 text-slate-600" colSpan={6}>Tidak ada data akuisisi</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="text-sm text-amber-900">Belum ada data kombinasi bisnis untuk periode ini.</p>
        </div>
      )}
    </div>
  )
}
