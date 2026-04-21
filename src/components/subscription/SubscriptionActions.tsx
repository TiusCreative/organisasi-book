"use client"

import { useState, useTransition } from "react"
import Script from "next/script"
import { useRouter } from "next/navigation"
import { createMidtransAnnualPayment, extendSubscriptionManually } from "../../app/actions/subscription"

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        options?: {
          onSuccess?: (result: unknown) => void
          onPending?: (result: unknown) => void
          onError?: (result: unknown) => void
          onClose?: () => void
        }
      ) => void
    }
  }
}

export default function SubscriptionActions({
  midtransReady,
  midtransClientKey,
  midtransScriptUrl,
}: {
  midtransReady: boolean
  midtransClientKey: string
  midtransScriptUrl: string
}) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const [manualYears, setManualYears] = useState("1")
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleMidtrans = () => {
    setError("")
    setInfo("")

    startTransition(async () => {
      const result = await createMidtransAnnualPayment()
      if (!result.success) {
        setError(result.error || "Gagal membuat transaksi Midtrans.")
        return
      }

      setInfo(result.reused ? "Menggunakan tagihan Midtrans yang masih pending." : "Tagihan Midtrans berhasil dibuat.")
      if (result.snapToken && window.snap) {
        window.snap.pay(result.snapToken, {
          onSuccess: () => {
            setInfo("Pembayaran Midtrans berhasil.")
            router.refresh()
            window.setTimeout(() => window.location.reload(), 1200)
          },
          onPending: () => {
            setInfo("Pembayaran sudah dibuat dan sedang menunggu penyelesaian.")
            router.refresh()
            window.setTimeout(() => window.location.reload(), 1200)
          },
          onError: () => {
            setError("Pembayaran Midtrans gagal diproses.")
          },
          onClose: () => {
            setInfo("Popup Midtrans ditutup sebelum pembayaran selesai.")
            router.refresh()
            window.setTimeout(() => window.location.reload(), 1500)
          },
        })
        return
      }

      if (result.redirectUrl) {
        window.open(result.redirectUrl, "_blank", "noopener,noreferrer")
      }
    })
  }

  const handleManual = () => {
    setError("")
    setInfo("")

    startTransition(async () => {
      const formData = new FormData()
      formData.set("years", manualYears)
      const result = await extendSubscriptionManually(formData)
      if (!result.success) {
        setError(result.error || "Gagal memperpanjang manual.")
        return
      }

      setInfo("Langganan berhasil diperpanjang manual.")
      router.refresh()
      window.location.reload()
    })
  }

  return (
    <div className="space-y-4">
      {midtransReady && (
        <Script
          id="midtrans-snap"
          src={midtransScriptUrl}
          data-client-key={midtransClientKey}
          strategy="afterInteractive"
          onLoad={() => setScriptLoaded(true)}
        />
      )}

      {(error || info) && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {error || info}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-800">Midtrans</h2>
        <p className="mt-2 text-sm text-slate-500">
          Bayar langganan tahunan secara otomatis melalui Midtrans.
        </p>
        <button
          type="button"
          disabled={!midtransReady || !scriptLoaded || isPending}
          onClick={handleMidtrans}
          className="mt-4 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Memproses..." : "Bayar dengan Midtrans"}
        </button>
        {midtransReady && !scriptLoaded && (
          <p className="mt-3 text-xs text-slate-500">
            Memuat Snap.js dari Midtrans...
          </p>
        )}
        {!midtransReady && (
          <p className="mt-3 text-xs text-amber-700">
            Midtrans belum aktif. Hubungi developer untuk aktivasi.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-800">Butuh Bantuan?</h2>
        <p className="mt-2 text-sm text-slate-500">
          Untuk yang ingin berlangganan langsung, silakan hubungi developer melalui WhatsApp.
        </p>
        <a
          href="https://wa.me/6285117021168"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-bold text-white hover:bg-green-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Hubungi Developer (WhatsApp)
        </a>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-800">Perpanjangan Manual</h2>
        <p className="mt-2 text-sm text-slate-500">
          Dipakai jika pembayaran dilakukan di luar sistem, misalnya transfer manual yang sudah Anda verifikasi sendiri.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="number"
            min="1"
            value={manualYears}
            onChange={(event) => setManualYears(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 sm:w-40"
          />
          <button
            type="button"
            disabled={isPending}
            onClick={handleManual}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"
          >
            Tambah Masa Aktif Manual
          </button>
        </div>
      </div>
    </div>
  )
}
