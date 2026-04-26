"use client"

import { useState, useRef } from "react"
import { Upload, X, Image as ImageIcon } from "lucide-react"
import { uploadImageToR2, deleteImageFromR2 } from "@/app/actions/upload"

interface ImageUploadProps {
  value?: string
  onChange?: (url: string) => void
  folder?: "catalog" | "system" | "temp"
  accept?: string
  maxSizeMB?: number
  className?: string
}

export default function ImageUpload({
  value,
  onChange,
  folder = "catalog",
  accept = "image/*",
  maxSizeMB = 5,
  className = "",
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string>()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File size must be less than ${maxSizeMB}MB`)
      return
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed")
      return
    }

    setIsUploading(true)
    setError(undefined)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("folder", folder)

      const result = await uploadImageToR2(formData)

      if (result.success && result.url) {
        onChange?.(result.url)
      } else {
        setError(result.error || "Failed to upload image")
      }
    } catch (err) {
      setError("Failed to upload image")
    } finally {
      setIsUploading(false)
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleRemove = async () => {
    if (!value) return

    try {
      // Extract key from URL
      const urlParts = value.split("/")
      const key = urlParts.slice(-2).join("/") // folder/filename
      
      await deleteImageFromR2(key)
      onChange?.("")
    } catch (err) {
      console.error("Failed to delete image:", err)
      // Still clear the value even if delete fails
      onChange?.("")
    }
  }

  return (
    <div className={`relative ${className}`}>
      {value ? (
        <div className="relative group">
          <img
            src={value}
            alt="Uploaded"
            className="w-full h-48 object-cover rounded-lg border border-slate-200"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            title="Remove image"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition-colors"
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400" />
              <p className="text-sm text-slate-500">Uploading...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <ImageIcon size={32} className="text-slate-400" />
              <p className="text-sm text-slate-500">Click to upload image</p>
              <p className="text-xs text-slate-400">Max {maxSizeMB}MB</p>
            </div>
          )}
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
      />
      {error && (
        <p className="mt-2 text-xs text-red-500">{error}</p>
      )}
    </div>
  )
}
