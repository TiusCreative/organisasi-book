"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { deleteOrganization } from "../../app/actions/organization"

interface DeleteOrganizationButtonProps {
  organizationId: string
  organizationName: string
}

export default function DeleteOrganizationButton({
  organizationId,
  organizationName,
}: DeleteOrganizationButtonProps) {
  const [confirmation, setConfirmation] = useState("")
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const expectedValue = organizationName.trim()
  const isMatch = confirmation.trim() === expectedValue

  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 space-y-4">
      <div>
        <h3 className="text-lg font-bold text-rose-800">Hapus Organisasi Uji Coba</h3>
        <p className="text-sm text-rose-700 mt-1">
          Tindakan ini akan menghapus organisasi beserta transaksi, bank, karyawan, slip gaji, pajak, akun, dan data terkait lainnya.
        </p>
      </div>

      <div className="rounded-lg border border-rose-200 bg-white px-4 py-3 text-sm text-slate-700">
        Untuk konfirmasi, ketik nama organisasi persis seperti ini:
        <div className="mt-2 font-bold text-rose-700">{organizationName}</div>
      </div>

      <div>
        <input
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder="Ketik nama organisasi untuk konfirmasi"
          className="w-full rounded-xl border border-rose-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-400"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-white px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <button
        type="button"
        disabled={!isMatch || isPending}
        onClick={() => {
          setError("")

          startTransition(async () => {
            const result = await deleteOrganization(organizationId)
            if (!result.success) {
              setError(result.error || "Gagal menghapus organisasi.")
              return
            }

            router.push("/setup")
            router.refresh()
          })
        }}
        className="rounded-xl bg-rose-600 px-5 py-3 font-bold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Menghapus..." : "Hapus Organisasi"}
      </button>
    </div>
  )
}
