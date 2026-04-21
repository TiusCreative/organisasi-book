"use client"

import { useEffect, useState, useTransition } from "react"
import {
  checkMidtransSubscriptionStatus,
  getSubscriptionPaymentsRealtime,
} from "../../app/actions/subscription"
import type { SubscriptionPaymentSummary } from "../../lib/subscription-payment"

function statusClasses(status: string) {
  switch (status) {
    case "SETTLEMENT":
      return "bg-emerald-50 text-emerald-700 border-emerald-200"
    case "PENDING":
      return "bg-amber-50 text-amber-700 border-amber-200"
    case "EXPIRE":
    case "CANCEL":
    case "DENY":
      return "bg-rose-50 text-rose-700 border-rose-200"
    default:
      return "bg-slate-50 text-slate-700 border-slate-200"
  }
}

export default function SubscriptionPaymentTable({
  initialPayments,
}: {
  initialPayments: SubscriptionPaymentSummary[]
}) {
  const [payments, setPayments] = useState(initialPayments)
  const [message, setMessage] = useState("")
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!payments.some((payment) => payment.status === "PENDING" && payment.provider === "MIDTRANS")) {
      return
    }

    const intervalId = window.setInterval(() => {
      startTransition(async () => {
        const result = await getSubscriptionPaymentsRealtime()
        if (result.success) {
          setPayments(result.payments)
        }
      })
    }, 10000)

    return () => window.clearInterval(intervalId)
  }, [payments])

  const handleCheckStatus = (orderId: string) => {
    setMessage("")
    startTransition(async () => {
      const result = await checkMidtransSubscriptionStatus(orderId)
      if (!result.success) {
        setMessage(result.error || "Gagal memeriksa status Midtrans.")
        return
      }

      const refreshed = await getSubscriptionPaymentsRealtime()
      if (refreshed.success) {
        setPayments(refreshed.payments)
      }
      setMessage("Status Midtrans berhasil diperbarui.")
    })
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold text-slate-800">Riwayat Pembayaran</h2>
        {isPending && <span className="text-xs text-slate-500">Memperbarui status...</span>}
      </div>

      {message && (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {message}
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-bold">Order ID</th>
              <th className="px-4 py-3 font-bold">Provider</th>
              <th className="px-4 py-3 font-bold">Status</th>
              <th className="px-4 py-3 font-bold">Nominal</th>
              <th className="px-4 py-3 font-bold">Dibuat</th>
              <th className="px-4 py-3 font-bold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payments.map((payment) => (
              <tr key={payment.id}>
                <td className="px-4 py-3 font-mono text-xs text-slate-700">{payment.orderId}</td>
                <td className="px-4 py-3 text-slate-600">{payment.provider}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusClasses(payment.status)}`}>
                    {payment.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">Rp {payment.amount.toLocaleString("id-ID")}</td>
                <td className="px-4 py-3 text-slate-600">{new Date(payment.createdAt).toLocaleDateString("id-ID")}</td>
                <td className="px-4 py-3 text-right">
                  {payment.provider === "MIDTRANS" ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleCheckStatus(payment.orderId)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Cek Status Midtrans
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">Manual</span>
                  )}
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Belum ada riwayat pembayaran langganan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
