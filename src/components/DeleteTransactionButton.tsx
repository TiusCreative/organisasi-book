"use client"

import { Trash2 } from "lucide-react"
import { deleteTransaction } from "../app/actions/transaction"
import { useState } from "react"

interface DeleteTransactionButtonProps {
  transactionId: string
}

export default function DeleteTransactionButton({ transactionId }: DeleteTransactionButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (window.confirm("Apakah Anda yakin ingin menghapus transaksi ini? Tindakan ini tidak dapat dibatalkan.")) {
      setIsDeleting(true)
      try {
        const result = await deleteTransaction(transactionId)
        if (!result.success) {
          alert("Gagal menghapus transaksi")
          setIsDeleting(false)
        }
      } catch (error) {
        console.error("Error deleting transaction:", error)
        alert("Gagal menghapus transaksi")
        setIsDeleting(false)
      }
    }
  }

  return (
    <button 
      onClick={handleDelete}
      disabled={isDeleting}
      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-100 transition-colors disabled:opacity-50"
      title="Hapus Transaksi"
    >
      <Trash2 size={16} />
    </button>
  )
}
