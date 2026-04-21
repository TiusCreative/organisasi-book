"use client"

import { Trash2 } from "lucide-react"
import { deleteAsset } from "../app/actions/asset"

type DeleteFixedAssetButtonProps = {
  assetId: string
  assetName: string
}

export default function DeleteFixedAssetButton({ assetId, assetName }: DeleteFixedAssetButtonProps) {
  const handleDelete = async () => {
    if (!window.confirm(`Hapus aset "${assetName}"?`)) {
      return
    }

    const result = await deleteAsset(assetId)
    if (!result.success) {
      window.alert(result.error || "Gagal menghapus aset")
      return
    }

    window.location.reload()
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      className="inline-flex items-center justify-center gap-1 px-2 py-1 text-rose-600 hover:bg-rose-50 rounded text-xs sm:text-sm font-medium transition-colors"
    >
      <Trash2 size={16} /> Hapus
    </button>
  )
}
