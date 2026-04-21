"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { loginUser } from "../../app/actions/auth"

export default function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      const formData = new FormData()
      formData.set("email", email)
      formData.set("password", password)

      const result = await loginUser(formData)
      if (!result.success) {
        setError(result.error || "Email atau password salah")
        return
      }

      router.push(result.redirectTo || "/")
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm">{error}</div>}
      <div>
        <label className="block text-sm font-bold mb-1 text-slate-700">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
          placeholder="you@email.com"
        />
      </div>
      <div>
        <label className="block text-sm font-bold mb-1 text-slate-700">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
          placeholder="••••••••"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all mt-2 disabled:opacity-60"
      >
        {isPending ? "Memproses..." : "Login"}
      </button>
      <p className="text-center text-sm text-slate-500">
        Belum punya akun?{" "}
        <a href="/register" className="font-semibold text-blue-600 hover:text-blue-700">
          Daftar organisasi baru
        </a>
      </p>
    </form>
  )
}
