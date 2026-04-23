"use client"

import { useState, useCallback } from "react"
import { Database, Download, Upload, Trash2, RefreshCw, FileText, AlertTriangle, Check, X, Loader2 } from "lucide-react"
import {
  createFullBackup,
  createSchemaBackup,
  createDataBackup,
  listBackups,
  deleteBackup,
  restoreBackup,
  downloadBackup,
  uploadAndRestore,
} from "../../app/actions/backup-restore"

interface BackupFile {
  filename: string
  type: "full" | "schema" | "data"
  size: number
  createdAt: string
}

export default function BackupActions() {
  const [backups, setBackups] = useState<BackupFile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null)
  const [restoreOptions, setRestoreOptions] = useState({
    dropExisting: false,
    dryRun: false,
  })
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)

  // Load backups list
  const loadBackups = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await listBackups()
      setBackups(result)
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to load backups",
      })
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Create full backup
  const handleCreateFullBackup = async () => {
    setIsCreating(true)
    setMessage(null)
    try {
      const result = await createFullBackup()
      setMessage({
        type: "success",
        text: `Backup berhasil dibuat: ${result.filename} (${formatBytes(result.size)})`,
      })
      await loadBackups()
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Backup failed",
      })
    } finally {
      setIsCreating(false)
    }
  }

  // Create schema backup
  const handleCreateSchemaBackup = async () => {
    setIsCreating(true)
    setMessage(null)
    try {
      const result = await createSchemaBackup()
      setMessage({
        type: "success",
        text: `Schema backup berhasil dibuat: ${result.filename} (${formatBytes(result.size)})`,
      })
      await loadBackups()
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Schema backup failed",
      })
    } finally {
      setIsCreating(false)
    }
  }

  // Create data backup
  const handleCreateDataBackup = async () => {
    setIsCreating(true)
    setMessage(null)
    try {
      const result = await createDataBackup()
      setMessage({
        type: "success",
        text: `Data backup berhasil dibuat: ${result.filename} (${formatBytes(result.size)})`,
      })
      await loadBackups()
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Data backup failed",
      })
    } finally {
      setIsCreating(false)
    }
  }

  // Delete backup
  const handleDeleteBackup = async (filename: string) => {
    if (!confirm(`Yakin ingin menghapus backup ${filename}?`)) return

    setIsLoading(true)
    setMessage(null)
    try {
      await deleteBackup(filename)
      setMessage({
        type: "success",
        text: `Backup ${filename} berhasil dihapus`,
      })
      await loadBackups()
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Delete failed",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Restore backup
  const handleRestoreBackup = async (filename: string) => {
    const confirmMessage = restoreOptions.dropExisting
      ? `PERINGATAN: Database akan di-drop dan dibuat ulang. Semua data akan dihapus dan diganti dengan backup ${filename}. Lanjutkan?`
      : `Yakin ingin restore database dari backup ${filename}? Data saat ini mungkin akan ditimpa.`

    if (!confirm(confirmMessage)) return

    setIsLoading(true)
    setMessage(null)
    try {
      const result = await restoreBackup(filename, restoreOptions)
      if (result.dryRun) {
        setMessage({
          type: "success",
          text: `Dry run: ${result.message}`,
        })
      } else {
        setMessage({
          type: "success",
          text: `Restore berhasil: ${result.message}`,
        })
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Restore failed",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Download backup
  const handleDownloadBackup = async (filename: string) => {
    try {
      const result = await downloadBackup(filename)
      
      // Convert base64 to blob and download
      const byteCharacters = atob(result.content)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: "application/sql" })
      
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Download failed",
      })
    }
  }

  // Handle file upload
  const handleFileUpload = async () => {
    if (!uploadFile) {
      setMessage({ type: "error", text: "Pilih file SQL terlebih dahulu" })
      return
    }

    const confirmMessage = restoreOptions.dropExisting
      ? "PERINGATAN: Database akan di-drop dan dibuat ulang. Lanjutkan?"
      : "Yakin ingin restore database dari file yang diupload?"

    if (!confirm(confirmMessage)) return

    setIsLoading(true)
    setMessage(null)
    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string
          const base64Content = btoa(content)
          const result = await uploadAndRestore(base64Content, {
            dropExisting: restoreOptions.dropExisting,
          })
          setMessage({
            type: "success",
            text: `Restore berhasil: ${result.message}`,
          })
        } catch (error) {
          setMessage({
            type: "error",
            text: error instanceof Error ? error.message : "Upload and restore failed",
          })
        } finally {
          setIsLoading(false)
          setUploadFile(null)
        }
      }
      reader.readAsText(uploadFile)
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "File read failed",
      })
      setIsLoading(false)
    }
  }

  // Format bytes to human readable
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("id-ID", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="space-y-6">
      {/* Message */}
      {message && (
        <div
          className={`rounded-lg p-4 ${
            message.type === "success"
              ? "border border-emerald-200 bg-emerald-50"
              : "border border-rose-200 bg-rose-50"
          }`}
        >
          <div className="flex items-start gap-3">
            {message.type === "success" ? (
              <Check className="mt-0.5 text-emerald-600" size={18} />
            ) : (
              <X className="mt-0.5 text-rose-600" size={18} />
            )}
            <p className={message.type === "success" ? "text-emerald-800" : "text-rose-800"}>
              {message.text}
            </p>
          </div>
        </div>
      )}

      {/* Create Backup Buttons */}
      <div className="grid gap-3 sm:grid-cols-3">
        <button
          onClick={handleCreateFullBackup}
          disabled={isCreating}
          className="flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
        >
          {isCreating ? <Loader2 className="animate-spin" size={18} /> : <Database size={18} />}
          Backup Full Database
        </button>
        <button
          onClick={handleCreateSchemaBackup}
          disabled={isCreating}
          className="flex items-center justify-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm font-bold text-purple-700 hover:bg-purple-100 disabled:opacity-50"
        >
          {isCreating ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
          Backup Schema Only
        </button>
        <button
          onClick={handleCreateDataBackup}
          disabled={isCreating}
          className="flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
        >
          {isCreating ? <Loader2 className="animate-spin" size={18} /> : <Database size={18} />}
          Backup Data Only
        </button>
      </div>

      {/* Restore Options */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="mb-3 font-semibold text-slate-800">Opsi Restore</h3>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={restoreOptions.dropExisting}
              onChange={(e) =>
                setRestoreOptions((prev) => ({ ...prev, dropExisting: e.target.checked }))
              }
              className="rounded border-slate-300"
            />
            <span className="text-sm text-slate-700">Drop database sebelum restore</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={restoreOptions.dryRun}
              onChange={(e) =>
                setRestoreOptions((prev) => ({ ...prev, dryRun: e.target.checked }))
              }
              className="rounded border-slate-300"
            />
            <span className="text-sm text-slate-700">Dry run (validasi saja)</span>
          </label>
        </div>
        {restoreOptions.dropExisting && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-100 p-3 text-sm text-amber-800">
            <AlertTriangle size={16} className="mt-0.5" />
            <span>Database akan dihapus total dan dibuat ulang. Semua data akan hilang!</span>
          </div>
        )}
      </div>

      {/* Upload & Restore */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="mb-3 font-semibold text-slate-800">Upload & Restore</h3>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="file"
            accept=".sql"
            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            onClick={handleFileUpload}
            disabled={!uploadFile || isLoading}
            className="flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
            Upload & Restore
          </button>
        </div>
      </div>

      {/* Backup List */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Daftar Backup</h3>
          <button
            onClick={loadBackups}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {backups.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
            <Database className="mx-auto mb-3 text-slate-400" size={48} />
            <p className="text-slate-500">Belum ada backup. Klik Refresh untuk memuat daftar backup.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-bold">Nama File</th>
                  <th className="px-4 py-3 font-bold">Tipe</th>
                  <th className="px-4 py-3 font-bold">Ukuran</th>
                  <th className="px-4 py-3 font-bold">Dibuat</th>
                  <th className="px-4 py-3 font-bold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {backups.map((backup) => (
                  <tr key={backup.filename}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">
                      {backup.filename}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${
                          backup.type === "full"
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : backup.type === "schema"
                            ? "border-purple-200 bg-purple-50 text-purple-700"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {backup.type === "full" ? "Full" : backup.type === "schema" ? "Schema" : "Data"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatBytes(backup.size)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(backup.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleDownloadBackup(backup.filename)}
                          className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-blue-700 hover:bg-blue-100"
                          title="Download"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          onClick={() => handleRestoreBackup(backup.filename)}
                          disabled={isLoading}
                          className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                          title="Restore"
                        >
                          <RefreshCw size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteBackup(backup.filename)}
                          disabled={isLoading}
                          className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
