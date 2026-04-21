import RegisterForm from "../../../components/auth/RegisterForm"

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,_#dbeafe,_#f8fafc_50%,_#e2e8f0)] px-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-blue-700">Daftar Organisasi Baru</h1>
          <p className="mt-2 text-sm text-slate-500">
            Buat akun owner, organisasi, dan aktifkan langganan tahunan 1 tahun dalam satu langkah.
          </p>
        </div>
        <RegisterForm />
      </div>
    </div>
  )
}
