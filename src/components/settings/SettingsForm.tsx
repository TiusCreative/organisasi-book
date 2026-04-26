"use client"

import React, { useState } from "react"
import { uploadImageToR2 } from "@/app/actions/upload"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Alert } from "@/components/ui/Alert"
import { Loader2, UploadCloud } from "lucide-react"

export default function SettingsForm() {
  const [isUploading, setIsUploading] = useState(false)
  const [logoUrl, setLogoUrl] = useState("")
  const [message, setMessage] = useState<{type: "success" | "error" | "info", text: string} | null>(null)

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setMessage({ type: "info", text: "Sedang mengunggah logo ke Cloudflare R2..." })

    const formData = new FormData()
    formData.append("file", file)

    try {
      const result = await uploadImageToR2(formData)
      if (result.success && result.url) {
        setLogoUrl(result.url)
        setMessage({ type: "success", text: "Logo perusahaan berhasil diunggah!" })
        // TODO: Simpan result.url ke database saat tombol "Simpan Pengaturan" diklik
      } else {
        setMessage({ type: "error", text: result.error || "Gagal mengunggah logo." })
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Terjadi kesalahan saat upload." })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 bg-white rounded-xl border border-slate-200 shadow-sm max-w-3xl">
      <h2 className="text-xl font-bold text-slate-800 mb-6">Pengaturan Organisasi</h2>
      
      <div className="space-y-6">
        {message && (
          <Alert variant={message.type} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        )}
        
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-slate-700">Logo Perusahaan (Cloudflare R2)</label>
          <div className="flex items-center gap-6 p-4 border border-slate-200 rounded-xl bg-slate-50">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo Perusahaan" className="h-20 w-20 object-contain rounded-lg border border-slate-300 bg-white p-1 shadow-sm" />
            ) : (
              <div className="h-20 w-20 bg-white flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-slate-400">
                <UploadCloud size={24} className="mb-1 opacity-50" />
                <span className="text-[10px] font-medium">No Logo</span>
              </div>
            )}
            <div className="flex-1 relative">
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleLogoUpload}
                disabled={isUploading}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-60 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 transition-colors cursor-pointer"
              />
              <p className="text-xs text-slate-500 mt-2">Maksimal ukuran file: 2MB. Format: JPG, PNG, WEBP.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}