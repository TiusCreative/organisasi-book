"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

export default function TokenPasswordForm({
  token,
  mode,
  action,
}: {
  token: string
  mode: "invite" | "reset"
  action: (formData: FormData) => Promise<{ success: boolean; error?: string }>
}) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")

    startTransition(async () => {
      const formData = new FormData()
      formData.set("token", token)
      formData.set("password", password)

      const result = await action(formData)
      if (!result.success) {
        setError(result.error || "Gagal memproses password.")
        return
      }

      router.push("/login")
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-bold text-slate-700">
          {mode === "invite" ? "Buat Password Baru" : "Password Baru"}
        </label>
        <input
          type="password"
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-xl border border-slate-200 px-4 py-3"
          placeholder="Minimal 8 karakter"
          required
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {isPending
          ? "Memproses..."
          : mode === "invite"
            ? "Aktifkan Akun"
            : "Simpan Password Baru"}
      </button>
    </form>
  )
}
