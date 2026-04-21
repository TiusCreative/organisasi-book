import { CalendarClock, CreditCard, ShieldCheck } from "lucide-react"
import { requireModuleAccess } from "../../lib/auth"
import { formatSubscriptionPeriod } from "../../lib/subscription"
import { getMidtransClientKey, getMidtransSnapBaseUrl, isMidtransConfigured } from "../../lib/midtrans"
import SubscriptionActions from "../../components/subscription/SubscriptionActions"
import SubscriptionPaymentTable from "../../components/subscription/SubscriptionPaymentTable"
import { getOrganizationSubscriptionPayments } from "../../lib/subscription-payment"

export default async function BerlanggananPage() {
  const {
    organization,
    subscriptionExpired,
    subscriptionInGracePeriod,
    subscriptionReminderActive,
    subscriptionGraceEndsAt,
    subscriptionExpiresInDays,
    user,
  } = await requireModuleAccess("subscription", {
    allowExpired: true,
  })
  const payments = await getOrganizationSubscriptionPayments(organization.id)
  const midtransReady = isMidtransConfigured()
  const midtransClientKey = getMidtransClientKey()
  const midtransScriptUrl = `${getMidtransSnapBaseUrl()}/snap/snap.js`

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Berlangganan</h1>
        <p className="mt-1 text-sm text-slate-500">
          Kelola masa aktif organisasi Anda. Paket saat ini berlaku 1 tahun per perpanjangan.
        </p>
      </div>

      <div className={`rounded-2xl border p-6 ${subscriptionExpired ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
        <div className="flex items-start gap-4">
          <div className={`rounded-xl p-3 ${subscriptionExpired ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">{organization.name}</h2>
            <p className="text-sm text-slate-600">
              Status langganan: <span className="font-semibold">{subscriptionExpired ? "EXPIRED" : organization.subscriptionStatus}</span>
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Periode aktif: {formatSubscriptionPeriod(organization.subscriptionStartsAt, organization.subscriptionEndsAt)}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Paket: {organization.subscriptionPlan} dengan batas {organization.maxUsers} user.
            </p>
            {subscriptionReminderActive && (
              <p className="mt-2 text-sm font-semibold text-amber-700">
                Langganan akan berakhir sekitar {subscriptionExpiresInDays} hari lagi.
              </p>
            )}
            {subscriptionInGracePeriod && (
              <p className="mt-2 text-sm font-semibold text-amber-700">
                Masa grace period aktif sampai {subscriptionGraceEndsAt ? new Date(subscriptionGraceEndsAt).toLocaleDateString("id-ID") : "-"}.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <CalendarClock className="text-blue-600" />
          <h3 className="mt-3 font-bold text-slate-800">Durasi</h3>
          <p className="mt-1 text-sm text-slate-500">Setiap perpanjangan menambah masa aktif selama 1 tahun.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <CreditCard className="text-blue-600" />
          <h3 className="mt-3 font-bold text-slate-800">Perpanjangan</h3>
          <p className="mt-1 text-sm text-slate-500">Saat ini tombol perpanjangan bekerja manual di sistem. Nantinya bisa disambungkan ke payment gateway.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <ShieldCheck className="text-blue-600" />
          <h3 className="mt-3 font-bold text-slate-800">Akses</h3>
          <p className="mt-1 text-sm text-slate-500">Jika langganan habis, user tetap bisa login ke halaman ini untuk memperpanjang.</p>
        </div>
      </div>

      {user.role === "ADMIN" ? (
        <SubscriptionActions
          midtransReady={midtransReady}
          midtransClientKey={midtransClientKey}
          midtransScriptUrl={midtransScriptUrl}
        />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Hanya admin organisasi yang dapat melakukan perpanjangan langganan.
        </div>
      )}

      <SubscriptionPaymentTable initialPayments={payments} />
    </div>
  )
}
