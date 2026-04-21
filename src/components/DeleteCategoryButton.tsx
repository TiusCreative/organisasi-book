"use client"

import { Trash2 } from "lucide-react"
import { deleteAccountCategory } from "../app/actions/category"
import { useState } from "react"

interface DeleteCategoryButtonProps {
  categoryId: string
}

export default function DeleteCategoryButton({ categoryId }: DeleteCategoryButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (window.confirm("Apakah Anda yakin ingin menghapus kategori ini?")) {
      setIsDeleting(true)
      try {
        await deleteAccountCategory(categoryId)
      } catch (error) {
        console.error("Error deleting category:", error)
        alert("Gagal menghapus kategori")
        setIsDeleting(false)
      }
    }
  }

  return (
    <button 
      onClick={handleDelete}
      disabled={isDeleting}
      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-100 transition-colors disabled:opacity-50"
      title="Hapus Kategori"
    >
      <Trash2 size={16} />
    </button>
  )
}
