"use client"

import { Trash2 } from "lucide-react"
import { deleteChartOfAccount } from "../app/actions/account"
import { useState } from "react"

interface DeleteAccountButtonProps {
  accountId: string
}

export default function DeleteAccountButton({ accountId }: DeleteAccountButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (window.confirm("Apakah Anda yakin ingin menghapus akun ini?")) {
      setIsDeleting(true)
      try {
        const result = await deleteChartOfAccount(accountId)
        if (!result.success) {
          alert(result.error || "Gagal menghapus akun")
          setIsDeleting(false)
        }
      } catch (error) {
        console.error("Error deleting account:", error)
        alert("Gagal menghapus akun")
        setIsDeleting(false)
      }
    }
  }

  return (
    <button 
      onClick={handleDelete}
      disabled={isDeleting}
      className="text-red-600 hover:underline text-sm font-medium disabled:opacity-50"
      title="Hapus Akun"
    >
      Hapus
    </button>
  )
}
