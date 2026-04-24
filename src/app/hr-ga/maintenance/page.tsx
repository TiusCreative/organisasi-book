import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { requireModuleAccess } from "@/lib/auth"
import {
  createFacilityMaintenance,
  deleteFacilityMaintenance,
  updateFacilityMaintenanceStatus,
} from "@/app/actions/hr-ga"
import ReportActionButtons from "@/components/reports/ReportActionButtons"

type MaintenancePageProps = {
  searchParams?: Promise<{
    from?: string
    to?: string
    status?: string
  }>
}

function normalizeDateInput(value?: string) {
  const trimmed = String(value || "").trim()
  if (!trimmed) return null
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return null
  return trimmed
}

export default async function MaintenancePage({ searchParams }: MaintenancePageProps) {
  const { organization } = await requireModuleAccess("hrga")

  const params = searchParams ? await searchParams : {}
  const today = new Date()
  const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
  const defaultTo = today.toISOString().slice(0, 10)

  const fromInput = normalizeDateInput(params.from) || defaultFrom
  const toInput = normalizeDateInput(params.to) || defaultTo
  const statusFilter = String(params.status || "").trim()

  const fromDate = new Date(fromInput)
  const toDate = new Date(toInput)
  toDate.setHours(23, 59, 59, 999)

  const items = await prisma.facilityMaintenance.findMany({
    where: {
      organizationId: organization.id,
      ...(statusFilter ? { status: statusFilter } : {}),
      scheduledAt: { gte: fromDate, lte: toDate },
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
    take: 2000,
  })

  const totalEstimated = items.reduce((sum, item) => sum + Number(item.estimatedCost || 0), 0)
  const totalActual = items.reduce((sum, item) => sum + Number(item.actualCost || 0), 0)
  const pdfUrl =
    `/api/${organization.id}/reports/maintenance/pdf` +
    `?startDate=${encodeURIComponent(fromInput)}` +
    `&endDate=${encodeURIComponent(toInput)}` +
    (statusFilter ? `&status=${encodeURIComponent(statusFilter)}` : "")

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Facility Management</h1>
          <p className="mt-1 text-sm text-slate-500">Jadwal maintenance fasilitas/GA dan tracking biaya.</p>
        </div>
        <Link
          href="/hr-ga"
          className="inline-flex items-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
        >
          Kembali
        </Link>
      </div>

      <form className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-bold text-slate-700">Periode</label>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" name="from" defaultValue={fromInput} className="rounded-xl border border-slate-200 px-4 py-3 text-sm" />
              <input type="date" name="to" defaultValue={toInput} className="rounded-xl border border-slate-200 px-4 py-3 text-sm" />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-bold text-slate-700">Status</label>
            <select name="status" defaultValue={statusFilter} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm">
              <option value="">Semua</option>
              <option value="PLANNED">PLANNED</option>
              <option value="DONE">DONE</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
          <div className="sm:col-span-2 flex items-end">
            <button className="w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700">
              Tampilkan
            </button>
          </div>
        </div>
      </form>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <div className="text-sm text-slate-500">Total jadwal</div>
          <div className="text-2xl font-bold text-slate-800">{items.length}</div>
          <div className="mt-1 text-xs text-slate-500">
            Estimasi: Rp {Number(totalEstimated).toLocaleString("id-ID")} • Aktual: Rp {Number(totalActual).toLocaleString("id-ID")}
          </div>
        </div>
        <ReportActionButtons
          pdfUrl={pdfUrl}
          whatsappText={`Laporan Maintenance (${fromInput} s/d ${toInput})`}
          printTargetId="maintenance-report"
          shareUrl=""
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-800">Tambah Jadwal Maintenance</h2>
        <form action={createFacilityMaintenance} className="mt-4 grid gap-3 md:grid-cols-6">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-bold text-slate-700">Nama Aset/Fasilitas</label>
            <input name="assetName" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" required />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-bold text-slate-700">Kategori</label>
            <input name="assetCategory" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="Kendaraan, Gedung, dll (opsional)" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700">Jadwal</label>
            <input type="date" name="scheduledAt" defaultValue={defaultTo} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700">Estimasi (IDR)</label>
            <input type="number" min={0} name="estimatedCost" defaultValue={0} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" />
          </div>
          <div className="md:col-span-6">
            <label className="mb-1 block text-sm font-bold text-slate-700">Catatan</label>
            <input name="notes" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="Opsional" />
          </div>
          <div className="md:col-span-6 flex justify-end">
            <button className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800">
              Simpan
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-800">Jadwal & Riwayat</h2>
        <div id="maintenance-report" className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-bold">Jadwal</th>
                <th className="px-4 py-3 font-bold">Aset</th>
                <th className="px-4 py-3 font-bold">Kategori</th>
                <th className="px-4 py-3 font-bold text-right">Estimasi</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr className="border-t border-slate-100">
                  <td colSpan={6} className="px-4 py-4 text-slate-500">
                    Belum ada jadwal maintenance.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-700">{new Date(item.scheduledAt).toLocaleDateString("id-ID")}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{item.assetName}</td>
                    <td className="px-4 py-3 text-slate-600">{item.assetCategory || "-"}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">
                      Rp {Number(item.estimatedCost || 0).toLocaleString("id-ID")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${
                        item.status === "DONE"
                          ? "bg-emerald-50 text-emerald-700"
                          : item.status === "CANCELLED"
                          ? "bg-rose-50 text-rose-700"
                          : "bg-amber-50 text-amber-700"
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <form action={updateFacilityMaintenanceStatus}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="status" value="DONE" />
                          <button className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100">
                            Done
                          </button>
                        </form>
                        <form action={updateFacilityMaintenanceStatus}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="status" value="CANCELLED" />
                          <button className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100">
                            Cancel
                          </button>
                        </form>
                        <form action={deleteFacilityMaintenance}>
                          <input type="hidden" name="id" value={item.id} />
                          <button className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100">
                            Delete
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
