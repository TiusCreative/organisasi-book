"use client"

import { useState } from "react"
import { Trash2 } from "lucide-react"

export default function DeleteOrganizationButton({
  organizationId,
  organizationName,
  onDelete,
}: {
  organizationId: string
  organizationName: string
  onDelete: (formData: FormData) => void
}) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmName, setConfirmName] = useState("")

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (confirmName.toLowerCase() !== organizationName.toLowerCase()) {
      alert("Nama organisasi tidak cocok. Penghapusan dibatalkan.")
      return
    }
    const formData = new FormData()
    formData.append("organizationId", organizationId)
    formData.append("confirmName", confirmName)
    onDelete(formData)
    setShowConfirm(false)
    setConfirmName("")
  }

  if (showConfirm) {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          type="text"
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
          placeholder={`Ketik "${organizationName}" untuk konfirmasi`}
          className="rounded-lg border border-red-200 px-3 py-2 text-xs w-full"
          autoFocus
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700"
          >
            <Trash2 size={12} className="inline mr-1" /> Hapus
          </button>
          <button
            type="button"
            onClick={() => {
              setShowConfirm(false)
              setConfirmName("")
            }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            Batal
          </button>
        </div>
      </form>
    )
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
    >
      <Trash2 size={12} className="inline mr-1" /> Hapus
    </button>
  )
}
