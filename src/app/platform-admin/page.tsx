import Link from "next/link"
import { Building2, CreditCard, Search, ShieldCheck, Trash2, Key, Mail } from "lucide-react"
import { requirePlatformAdmin } from "../../lib/auth"
import {
  setPlatformOrganizationSubscriptionStatus,
  updatePlatformOrganizationExpiry,
  deletePlatformOrganization,
  resetPlatformOwnerPassword,
  updatePlatformOwnerEmail,
} from "../actions/platform-admin"
import { prisma } from "../../lib/prisma"
import PlatformClientProvisionForm from "../../components/platform-admin/PlatformClientProvisionForm"
import PlatformOwnerAccessActions from "../../components/platform-admin/PlatformOwnerAccessActions"
import DeleteOrganizationButton from "../../components/platform-admin/DeleteOrganizationButton"

type PlatformAdminPageProps = {
  searchParams?: Promise<{
    q?: string
    status?: string
    payments?: string
  }>
}

function statusBadgeClasses(status: string) {
  switch (status) {
    case "ACTIVE":
    case "SETTLEMENT":
      return "border-emerald-200 bg-emerald-50 text-emerald-700"
    case "PENDING":
      return "border-amber-200 bg-amber-50 text-amber-700"
    case "SUSPENDED":
    case "EXPIRED":
    case "CANCEL":
    case "DENY":
    case "EXPIRE":
      return "border-rose-200 bg-rose-50 text-rose-700"
    default:
      return "border-slate-200 bg-slate-50 text-slate-700"
  }
}

function formatDateInput(date?: Date | null) {
  return date ? new Date(date).toISOString().slice(0, 10) : ""
}

export default async function PlatformAdminPage({ searchParams }: PlatformAdminPageProps) {
  await requirePlatformAdmin()

  const params = searchParams ? await searchParams : {}
  const query = (params.q || "").trim()
  const statusFilter = (params.status || "all").trim()
  const paymentFilter = (params.payments || "all").trim()

  const organizationWhere = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { email: { contains: query, mode: "insensitive" as const } },
          { phone: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {}

  const paymentWhere = {
    ...(query
      ? {
          organization: {
            OR: [
              { name: { contains: query, mode: "insensitive" as const } },
              { email: { contains: query, mode: "insensitive" as const } },
            ],
          },
        }
      : {}),
    ...(paymentFilter === "midtrans-only" ? { provider: "MIDTRANS" } : {}),
  }

  const [organizations, payments, organizationCount, auditLogs] = await Promise.all([
    prisma.organization.findMany({
      where: organizationWhere,
      include: {
        users: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.subscriptionPayment.findMany({
      where: paymentWhere,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.organization.count({
      where: organizationWhere,
    }),
    prisma.auditLog.findMany({
      where: {
        entity: "OrganizationSubscription",
        ...(query
          ? {
              organization: {
                OR: [
                  { name: { contains: query, mode: "insensitive" as const } },
                  { email: { contains: query, mode: "insensitive" as const } },
                ],
              },
            }
          : {}),
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { timestamp: "desc" },
      take: 20,
    }),
  ])

  const filteredOrganizations = organizations.filter((organization) => {
    const expired = organization.subscriptionEndsAt
      ? new Date(organization.subscriptionEndsAt).getTime() < Date.now()
      : false

    if (statusFilter === "all") return true
    if (statusFilter === "active") return organization.subscriptionStatus === "ACTIVE" && !expired
    if (statusFilter === "expired") return expired || organization.subscriptionStatus === "EXPIRED"
    if (statusFilter === "suspended") return organization.subscriptionStatus === "SUSPENDED"
    return true
  })

  const activeOrganizationCount = filteredOrganizations.filter((organization) => {
    const expired = organization.subscriptionEndsAt
      ? new Date(organization.subscriptionEndsAt).getTime() < Date.now()
      : false

    return organization.subscriptionStatus === "ACTIVE" && !expired
  }).length

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Platform Admin</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kelola subscription tenant, cari organisasi, dan lihat semua pembayaran Midtrans lintas tenant.
          </p>
        </div>
        <Link
          href="/admin"
          className="inline-flex items-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
        >
          Kembali ke Admin Organisasi
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <Building2 className="text-blue-600" />
          <p className="mt-3 text-sm text-slate-500">Organisasi</p>
          <p className="text-2xl font-bold text-slate-800">{organizationCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <ShieldCheck className="text-blue-600" />
          <p className="mt-3 text-sm text-slate-500">Subscription Aktif</p>
          <p className="text-2xl font-bold text-slate-800">{activeOrganizationCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <CreditCard className="text-blue-600" />
          <p className="mt-3 text-sm text-slate-500">Pembayaran Ditampilkan</p>
          <p className="text-2xl font-bold text-slate-800">{payments.length}</p>
        </div>
      </div>

      <form className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-slate-400" />
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Cari nama organisasi, email, atau telepon..."
              className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-sm"
            />
          </div>
          <select
            name="status"
            defaultValue={statusFilter}
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
          >
            <option value="all">Semua Status</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="suspended">Suspended</option>
          </select>
          <select
            name="payments"
            defaultValue={paymentFilter}
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
          >
            <option value="all">Semua Pembayaran</option>
            <option value="midtrans-only">Midtrans Only</option>
          </select>
          <button className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700">
            Cari
          </button>
        </div>
      </form>

      <PlatformClientProvisionForm />

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-800">Organisasi</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-bold">Organisasi</th>
                <th className="px-4 py-3 font-bold">Owner</th>
                <th className="px-4 py-3 font-bold">User</th>
                <th className="px-4 py-3 font-bold">Subscription</th>
                <th className="px-4 py-3 font-bold">Expiry</th>
                <th className="px-4 py-3 font-bold">Akses Owner</th>
                <th className="px-4 py-3 font-bold">Aksi Cepat</th>
                <th className="px-4 py-3 font-bold">Set Expiry</th>
                <th className="px-4 py-3 font-bold">Kelola Owner</th>
                <th className="px-4 py-3 font-bold">Hapus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrganizations.map((organization) => (
                <tr key={organization.id}>
                  {(() => {
                    const owner = organization.users.find((user) => user.role === "ADMIN")
                    return (
                      <>
                  <td className="px-4 py-4">
                    <div className="font-bold text-slate-800">{organization.name}</div>
                    <div className="text-xs text-slate-500">
                      {organization.email || "-"} | {organization.type}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-slate-600">
                    <div className="font-medium text-slate-800">{owner?.name || "-"}</div>
                    <div className="text-xs text-slate-500">{owner?.email || "-"}</div>
                  </td>
                  <td className="px-4 py-4 text-slate-600">{organization.users.length}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusBadgeClasses(organization.subscriptionStatus)}`}>
                      {organization.subscriptionStatus}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-600">
                    {organization.subscriptionEndsAt
                      ? new Date(organization.subscriptionEndsAt).toLocaleDateString("id-ID")
                      : "-"}
                  </td>
                  <td className="px-4 py-4">
                    <PlatformOwnerAccessActions organizationId={organization.id} />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <form action={setPlatformOrganizationSubscriptionStatus}>
                        <input type="hidden" name="organizationId" value={organization.id} />
                        <input type="hidden" name="action" value="activate" />
                        <button className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100">
                          Aktifkan
                        </button>
                      </form>
                      <form action={setPlatformOrganizationSubscriptionStatus}>
                        <input type="hidden" name="organizationId" value={organization.id} />
                        <input type="hidden" name="action" value="suspend" />
                        <button className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100">
                          Nonaktifkan
                        </button>
                      </form>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <form action={updatePlatformOrganizationExpiry} className="flex flex-col gap-2 sm:flex-row">
                      <input type="hidden" name="organizationId" value={organization.id} />
                      <input
                        type="date"
                        name="expiryDate"
                        defaultValue={formatDateInput(organization.subscriptionEndsAt)}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                      />
                      <button className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800">
                        Simpan
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <form action={resetPlatformOwnerPassword}>
                        <input type="hidden" name="organizationId" value={organization.id} />
                        <input type="hidden" name="newPassword" value="password123" />
                        <button
                          type="submit"
                          className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"
                        >
                          <Key size={12} className="inline mr-1" /> Reset
                        </button>
                      </form>
                      <form action={updatePlatformOwnerEmail}>
                        <input type="hidden" name="organizationId" value={organization.id} />
                        <input
                          type="email"
                          name="newEmail"
                          placeholder="Email baru"
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs w-full sm:w-auto"
                          required
                        />
                        <button
                          type="submit"
                          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
                        >
                          <Mail size={12} className="inline mr-1" /> Update
                        </button>
                      </form>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <DeleteOrganizationButton
                      organizationId={organization.id}
                      organizationName={organization.name}
                      onDelete={deletePlatformOrganization}
                    />
                  </td>
                      </>
                    )
                  })()}
                </tr>
              ))}
              {filteredOrganizations.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                    Tidak ada organisasi yang cocok dengan pencarian ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-800">Pembayaran Midtrans Lintas Tenant</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-bold">Organisasi</th>
                <th className="px-4 py-3 font-bold">Order ID</th>
                <th className="px-4 py-3 font-bold">Provider</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold">Nominal</th>
                <th className="px-4 py-3 font-bold">Dibuat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="px-4 py-4 font-medium text-slate-800">{payment.organization.name}</td>
                  <td className="px-4 py-4 font-mono text-xs text-slate-700">{payment.orderId}</td>
                  <td className="px-4 py-4 text-slate-600">{payment.provider}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusBadgeClasses(payment.status)}`}>
                      {payment.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-600">Rp {payment.amount.toLocaleString("id-ID")}</td>
                  <td className="px-4 py-4 text-slate-600">
                    {new Date(payment.createdAt).toLocaleDateString("id-ID")}
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Belum ada pembayaran Midtrans yang cocok dengan filter ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-800">Audit Log Subscription</h2>
        <p className="mt-1 text-sm text-slate-500">
          Riwayat aksi aktifkan, nonaktifkan, dan ubah expiry yang dilakukan super admin.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-bold">Waktu</th>
                <th className="px-4 py-3 font-bold">Organisasi</th>
                <th className="px-4 py-3 font-bold">User</th>
                <th className="px-4 py-3 font-bold">Aksi</th>
                <th className="px-4 py-3 font-bold">Perubahan</th>
                <th className="px-4 py-3 font-bold">Alasan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-4 text-slate-600">
                    {new Date(log.timestamp).toLocaleString("id-ID")}
                  </td>
                  <td className="px-4 py-4 font-medium text-slate-800">
                    {log.organization?.name || log.organizationId}
                  </td>
                  <td className="px-4 py-4 text-slate-600">
                    <div>{log.userName || "-"}</div>
                    <div className="text-xs text-slate-400">{log.userEmail || "-"}</div>
                  </td>
                  <td className="px-4 py-4 text-slate-600">{log.action}</td>
                  <td className="px-4 py-4 text-xs text-slate-500">
                    <pre className="whitespace-pre-wrap break-words font-mono">
                      {log.changes || log.newData || "-"}
                    </pre>
                  </td>
                  <td className="px-4 py-4 text-slate-600">{log.reason || "-"}</td>
                </tr>
              ))}
              {auditLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Belum ada audit log subscription yang cocok dengan filter ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
