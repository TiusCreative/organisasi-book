import LoginForm from "../../../components/auth/LoginForm"
import DatabaseErrorCard from "../../../components/DatabaseErrorCard"
import { ensureBootstrapAdmin } from "../../../lib/auth"

export default async function LoginPage() {
  try {
    await ensureBootstrapAdmin()
  } catch {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,_#fef3c7,_#fff7ed_45%,_#f8fafc)] px-4">
        <DatabaseErrorCard
          title="Halaman login gagal dimuat"
          description="Server tidak bisa membaca data user dari database. Biasanya ini terjadi karena DATABASE_URL di Vercel atau .env belum valid."
          retryHref="/login"
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,_#dbeafe,_#f8fafc_50%,_#e2e8f0)] px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
        <div className="text-center mb-6">
          <img src="/logo.png" alt="Organisasi Book" className="mx-auto h-16 w-16 rounded-2xl shadow-sm" />
          <h1 className="text-2xl font-bold mt-4 text-blue-700">Login</h1>
          <p className="text-sm text-slate-500 mt-2">Masuk memakai akun yang dibuat oleh admin.</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
