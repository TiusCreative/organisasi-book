"use client"

import { useEffect } from "react"
import DatabaseErrorCard from "../components/DatabaseErrorCard"

type ErrorPageProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fef3c7,_#fff7ed_45%,_#f8fafc)] px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-3xl space-y-4">
        <DatabaseErrorCard
          title="Halaman ini gagal dimuat"
          description="Ada error saat render halaman. Jika sumbernya dari koneksi database atau migrasi production, error ini akan berdampak ke menu-menu sidebar juga."
          retryHref="/"
          showRetryLink={false}
        />

        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
          <p className="font-semibold text-slate-800">Detail yang aman ditampilkan</p>
          <p className="mt-2 break-all">Digest: {error.digest || "tidak tersedia"}</p>
          <button
            type="button"
            onClick={() => reset()}
            className="mt-4 inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800"
          >
            Muat Ulang Halaman
          </button>
        </div>
      </div>
    </div>
  )
}
