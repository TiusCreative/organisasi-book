import Link from "next/link"
import { AlertTriangle, RefreshCcw, Wrench } from "lucide-react"

type DatabaseErrorCardProps = {
  title?: string
  description?: string
  retryHref?: string
  showSetupLink?: boolean
  showRetryLink?: boolean
}

export default function DatabaseErrorCard({
  title = "Aplikasi belum bisa terhubung ke database",
  description = "Periksa DATABASE_URL atau DIRECT_URL di Vercel dan file .env, lalu coba muat ulang halaman ini.",
  retryHref = "/",
  showSetupLink = true,
  showRetryLink = true,
}: DatabaseErrorCardProps) {
  return (
    <div className="w-full max-w-2xl rounded-3xl border border-amber-200 bg-white p-8 shadow-xl">
      <div className="mb-5 flex items-start gap-4">
        <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
          <AlertTriangle size={30} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-semibold text-slate-800">Yang perlu dicek:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>`DATABASE_URL` harus satu baris penuh tanpa line break.</li>
          <li>Jika memakai Supabase, host direct database harus valid dan bisa diakses Vercel.</li>
          <li>Pastikan migration Prisma sudah jalan di environment production.</li>
        </ul>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {showSetupLink ? (
          <Link
            href="/setup"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            <Wrench size={16} />
            Buka Setup
          </Link>
        ) : null}
        {showRetryLink ? (
          <Link
            href={retryHref}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <RefreshCcw size={16} />
            Coba Lagi
          </Link>
        ) : null}
      </div>
    </div>
  )
}
