"use client"

import { useState } from "react"
import { Download, Upload, FileJson, FileSpreadsheet, AlertCircle } from "lucide-react"
import { exportToJSON, exportToCSV, exportToExcel } from "../../lib/export-import-utils"

interface DatabaseExportImportProps {
  organizationId: string
  orgName: string
}

export default function DatabaseExportImport({ organizationId, orgName }: DatabaseExportImportProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [message, setMessage] = useState("")

  const handleExport = async (format: 'json' | 'csv' | 'excel') => {
    setIsExporting(true)
    setMessage("")
    try {
      // Fetch all data from API
      const response = await fetch(`/api/export?orgId=${organizationId}&format=${format}`)
      const data = await response.json()

      if (format === 'json') {
        exportToJSON(data)
      } else if (format === 'csv') {
        exportToCSV(data)
      } else if (format === 'excel') {
        exportToExcel(data)
      }

      setMessage("Data berhasil diekspor!")
      setTimeout(() => setMessage(""), 3000)
    } catch (error) {
      console.error("Export error:", error)
      setMessage("Gagal mengekspor data")
    } finally {
      setIsExporting(false)
    }
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    setMessage("")
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('orgId', organizationId)

      const response = await fetch('/api/import', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        setMessage("Data berhasil diimpor! Halaman akan dimuat ulang...")
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      } else {
        setMessage("Gagal mengimpor data")
      }
    } catch (error) {
      console.error("Import error:", error)
      setMessage("Gagal mengimpor data")
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${message.includes('berhasil') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
          <AlertCircle size={20} />
          {message}
        </div>
      )}

      {/* Export Section */}
      <div>
        <h3 className="font-bold text-slate-800 mb-4">Ekspor Data</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={() => handleExport('json')}
            disabled={isExporting}
            className="p-4 border-2 border-slate-200 rounded-lg hover:border-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50 flex flex-col items-center gap-2"
          >
            <FileJson size={24} className="text-blue-600" />
            <span className="font-bold text-slate-700">JSON</span>
            <span className="text-xs text-slate-500">Format database lengkap</span>
          </button>

          <button
            onClick={() => handleExport('csv')}
            disabled={isExporting}
            className="p-4 border-2 border-slate-200 rounded-lg hover:border-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50 flex flex-col items-center gap-2"
          >
            <FileSpreadsheet size={24} className="text-emerald-600" />
            <span className="font-bold text-slate-700">CSV</span>
            <span className="text-xs text-slate-500">Format spreadsheet</span>
          </button>

          <button
            onClick={() => handleExport('excel')}
            disabled={isExporting}
            className="p-4 border-2 border-slate-200 rounded-lg hover:border-orange-600 hover:bg-orange-50 transition-colors disabled:opacity-50 flex flex-col items-center gap-2"
          >
            <FileSpreadsheet size={24} className="text-orange-600" />
            <span className="font-bold text-slate-700">Excel</span>
            <span className="text-xs text-slate-500">Workbook Excel (.xls)</span>
          </button>
        </div>
        <p className="text-sm text-slate-500 mt-4">
          Ekspor semua data organisasi Anda dalam format yang dipilih. File ini bisa digunakan untuk backup atau di-share dengan pihak lain.
        </p>
      </div>

      <hr className="border-slate-200" />

      {/* Import Section */}
      <div>
        <h3 className="font-bold text-slate-800 mb-4">Impor Data</h3>
        <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
          <Upload size={32} className="mx-auto text-slate-400 mb-3" />
          <p className="font-bold text-slate-700 mb-1">Impor dari file backup</p>
          <p className="text-sm text-slate-500 mb-4">Pilih file JSON atau workbook Excel hasil ekspor dari sistem</p>
          
          <label className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors font-bold">
            <Upload size={18} />
            Pilih File
            <input 
              type="file" 
              accept=".json,.xls,.xml"
              onChange={handleImport}
              disabled={isImporting}
              className="hidden"
            />
          </label>

          {isImporting && <p className="text-sm text-slate-500 mt-2">Sedang mengimpor data...</p>}
        </div>

        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800 flex gap-2">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span><strong>Perhatian:</strong> Impor data akan mengganti data yang ada. Pastikan Anda telah membuat backup sebelumnya.</span>
          </p>
        </div>
      </div>

      {/* Schedule Backup Section */}
      <div>
        <h3 className="font-bold text-slate-800 mb-4">Rekomendasi Backup</h3>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            💡 Kami merekomendasikan untuk membuat backup data secara berkala (minimal 1x per minggu) untuk menghindari kehilangan data yang penting.
          </p>
        </div>
      </div>
    </div>
  )
}
