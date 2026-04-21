"use client"

import { useState } from "react"
import { deleteInvestment } from "../app/actions/investment"

export default function DeleteInvestmentButton({ investmentId }: { investmentId: string }) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus investasi ini?")) {
      return
    }

    setIsDeleting(true)
    const result = await deleteInvestment(investmentId)
    if (!result.success) {
      alert(result.error || "Gagal menghapus investasi")
      setIsDeleting(false)
    }
  }

  return (
    <button onClick={handleDelete} disabled={isDeleting} className="text-sm font-medium text-rose-600 hover:underline disabled:opacity-50">
      Hapus
    </button>
  )
}
