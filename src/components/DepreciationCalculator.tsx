"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, Printer, FileDown, Share2 } from "lucide-react"
import {
  generateDepreciationSchedule,
  calculateBookValue,
  calculateAccumulatedDepreciation,
  calculateCurrentYearDepreciation,
  calculateYearsInUse,
  FixedAsset
} from "../lib/depreciation-utils"

interface DepreciationCalculatorProps {
  asset: FixedAsset
}

export default function DepreciationCalculator({ asset }: DepreciationCalculatorProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const schedule = generateDepreciationSchedule(asset)
  const bookValue = calculateBookValue(asset)
  const accumulatedDepreciation = calculateAccumulatedDepreciation(asset)
  const currentYearDepreciation = calculateCurrentYearDepreciation(asset)
  const yearsInUse = calculateYearsInUse(asset.acquisitionDate)

  const handlePrint = () => {
    const printWindow = window.open('', '', 'height=600,width=800')
    const scheduleHTML = `
      <h2>${asset.name} - Jadwal Penyusutan</h2>
      <p>Metode: ${asset.depreciationMethod === 'straight-line' ? 'Garis Lurus' : 'Saldo Menurun'}</p>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f0f0f0;">
            <th style="border: 1px solid #ddd; padding: 8px;">Tahun</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Nilai Awal</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Penyusutan</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Akumulasi</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Nilai Buku</th>
          </tr>
        </thead>
        <tbody>
          ${schedule.map(row => `
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">${row.year}</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">Rp ${row.beginningValue.toLocaleString('id-ID')}</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">Rp ${row.depreciationExpense.toLocaleString('id-ID')}</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">Rp ${row.accumulatedDepreciation.toLocaleString('id-ID')}</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">Rp ${row.bookValue.toLocaleString('id-ID')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
    printWindow?.document.write(scheduleHTML)
    printWindow?.document.close()
    printWindow?.print()
  }

  const handleShareWhatsApp = () => {
    const message = encodeURIComponent(
      `Jadwal Penyusutan: ${asset.name}\nHarga Perolehan: Rp ${asset.acquisitionCost.toLocaleString('id-ID')}\nNilai Buku: Rp ${bookValue.toLocaleString('id-ID')}\nPenyusutan Tahun Ini: Rp ${currentYearDepreciation.toLocaleString('id-ID')}`
    )
    window.open(`https://wa.me/?text=${message}`, '_blank')
  }

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-6 flex justify-between items-center hover:bg-slate-50 transition-colors"
      >
        <div className="text-left">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-bold text-slate-800">{asset.name}</h3>
            <span className="text-xs font-mono bg-blue-50 text-blue-600 px-2 py-1 rounded">{asset.code}</span>
          </div>
          <p className="text-sm text-slate-500">
            Perolehan: {new Date(asset.acquisitionDate).toLocaleDateString('id-ID')} • 
            Harga: Rp {asset.acquisitionCost.toLocaleString('id-ID')} • 
            Umur: {asset.usefulLife} tahun
          </p>
        </div>
        {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
      </button>

      {isExpanded && (
        <>
          {/* Quick Summary */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 grid grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-slate-600 font-bold uppercase">Nilai Buku</p>
              <p className="text-lg font-bold text-blue-600">Rp {bookValue.toLocaleString('id-ID')}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600 font-bold uppercase">Penyusutan Terakumulasi</p>
              <p className="text-lg font-bold text-slate-700">Rp {accumulatedDepreciation.toLocaleString('id-ID')}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600 font-bold uppercase">Penyusutan Tahun Ini</p>
              <p className="text-lg font-bold text-emerald-600">Rp {currentYearDepreciation.toLocaleString('id-ID')}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600 font-bold uppercase">Tahun Penggunaan</p>
              <p className="text-lg font-bold text-slate-700">{yearsInUse} tahun</p>
            </div>
          </div>

          {/* Depreciation Schedule */}
          <div className="px-6 py-4 border-t border-slate-100">
            <h4 className="font-bold text-slate-700 mb-4">Jadwal Penyusutan</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-2 text-left font-bold text-slate-600">Tahun</th>
                    <th className="px-4 py-2 text-right font-bold text-slate-600">Nilai Awal</th>
                    <th className="px-4 py-2 text-right font-bold text-slate-600">Penyusutan</th>
                    <th className="px-4 py-2 text-right font-bold text-slate-600">Akumulasi</th>
                    <th className="px-4 py-2 text-right font-bold text-slate-600">Nilai Buku</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {schedule.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-bold text-slate-700">{row.year}</td>
                      <td className="px-4 py-2 text-right text-slate-600">Rp {row.beginningValue.toLocaleString('id-ID')}</td>
                      <td className="px-4 py-2 text-right text-emerald-600 font-bold">Rp {row.depreciationExpense.toLocaleString('id-ID')}</td>
                      <td className="px-4 py-2 text-right text-slate-600">Rp {row.accumulatedDepreciation.toLocaleString('id-ID')}</td>
                      <td className="px-4 py-2 text-right text-blue-600 font-bold">Rp {row.bookValue.toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-bold"
            >
              <Printer size={16} /> Cetak
            </button>
            <button
              onClick={handleShareWhatsApp}
              className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors font-bold"
            >
              <Share2 size={16} /> WhatsApp
            </button>
          </div>
        </>
      )}
    </div>
  )
}
