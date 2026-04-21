"use client"

import { useState, useTransition } from "react"
import { generatePlatformOwnerInvite, generatePlatformOwnerReset } from "../../app/actions/auth"

export default function PlatformOwnerAccessActions({
  organizationId,
}: {
  organizationId: string
}) {
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()

  const copyLink = async (path: string, label: string) => {
    const url = `${window.location.origin}${path}`
    await navigator.clipboard.writeText(url)
    window.alert(`${label} berhasil disalin:\n${url}`)
  }

  const handleInvite = () => {
    setError("")
    startTransition(async () => {
      const result = await generatePlatformOwnerInvite(organizationId)
      if (!result.success || !result.path) {
        setError(result.error || "Gagal membuat link undangan owner.")
        return
      }

      await copyLink(result.path, "Link undangan owner")
    })
  }

  const handleReset = () => {
    setError("")
    startTransition(async () => {
      const result = await generatePlatformOwnerReset(organizationId)
      if (!result.success || !result.path) {
        setError(result.error || "Gagal membuat link reset owner.")
        return
      }

      await copyLink(result.path, "Link reset owner")
    })
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={isPending}
          onClick={handleInvite}
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
        >
          Invite Owner
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={handleReset}
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-60"
        >
          Reset Owner
        </button>
      </div>
    </div>
  )
}
