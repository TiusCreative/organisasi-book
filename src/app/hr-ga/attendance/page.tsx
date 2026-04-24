import { prisma } from "@/lib/prisma"
import { requireModuleAccess } from "@/lib/auth"
import Link from "next/link"
import { deleteAttendanceRecord, upsertAttendanceRecord } from "@/app/actions/hr-ga"
import ReportActionButtons from "@/components/reports/ReportActionButtons"

type AttendancePageProps = {
  searchParams?: Promise<{
    from?: string
    to?: string
    employeeId?: string
  }>
}

function normalizeDateInput(value?: string) {
  const trimmed = String(value || "").trim()
  if (!trimmed) return null
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return null
  return trimmed
}

export default async function AttendancePage({ searchParams }: AttendancePageProps) {
  const { organization } = await requireModuleAccess("hrga")
  const params = searchParams ? await searchParams : {}

  const today = new Date()
  const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
  const defaultTo = today.toISOString().slice(0, 10)

  const fromInput = normalizeDateInput(params.from) || defaultFrom
  const toInput = normalizeDateInput(params.to) || defaultTo
  const employeeFilter = String(params.employeeId || "").trim()

  const fromDate = new Date(fromInput)
  const toDate = new Date(toInput)
  toDate.setHours(23, 59, 59, 999)

  const [employees, records] = await Promise.all([
    prisma.employee.findMany({
      where: { organizationId: organization.id, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, position: true },
    }),
    prisma.attendanceRecord.findMany({
      where: {
        organizationId: organization.id,
        ...(employeeFilter ? { employeeId: employeeFilter } : {}),
        date: { gte: fromDate, lte: toDate },
      },
      include: {
        employee: { select: { name: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 200,
    }),
  ])

  const totalOvertimeMinutes = records.reduce((sum, record) => sum + Number(record.overtimeMinutes || 0), 0)
  const pdfUrl =
    `/api/${organization.id}/reports/attendance/pdf` +
    `?startDate=${encodeURIComponent(fromInput)}` +
    `&endDate=${encodeURIComponent(toInput)}` +
    (employeeFilter ? `&employeeId=${encodeURIComponent(employeeFilter)}` : "")

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Time & Attendance</h1>
          <p className="mt-1 text-sm text-slate-500">Absensi karyawan untuk perhitungan lembur/payroll.</p>
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
            <label className="mb-1 block text-sm font-bold text-slate-700">Karyawan</label>
            <select name="employeeId" defaultValue={employeeFilter} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm">
              <option value="">Semua</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
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
          <div className="text-sm text-slate-500">Total record</div>
          <div className="text-2xl font-bold text-slate-800">{records.length}</div>
          <div className="mt-1 text-xs text-slate-500">Total lembur: {totalOvertimeMinutes} menit</div>
        </div>
        <ReportActionButtons
          pdfUrl={pdfUrl}
          whatsappText={`Laporan Absensi (${fromInput} s/d ${toInput})`}
          printTargetId="attendance-report"
          shareUrl=""
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-800">Input Absensi</h2>
        <p className="mt-1 text-sm text-slate-500">Jika tanggal+karyawan sudah ada, data akan di-update.</p>

        <form action={upsertAttendanceRecord} className="mt-4 grid gap-3 md:grid-cols-6">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-bold text-slate-700">Karyawan</label>
            <select name="employeeId" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" required>
              <option value="">Pilih karyawan</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} {emp.position ? `- ${emp.position}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700">Tanggal</label>
            <input type="date" name="date" defaultValue={defaultTo} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700">Masuk</label>
            <input type="time" name="checkInTime" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700">Keluar</label>
            <input type="time" name="checkOutTime" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700">Lembur (menit)</label>
            <input type="number" min={0} name="overtimeMinutes" defaultValue={0} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" />
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
        <h2 className="text-lg font-bold text-slate-800">Data Absensi</h2>
        <div id="attendance-report" className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-bold">Tanggal</th>
                <th className="px-4 py-3 font-bold">Karyawan</th>
                <th className="px-4 py-3 font-bold">Masuk</th>
                <th className="px-4 py-3 font-bold">Keluar</th>
                <th className="px-4 py-3 font-bold text-right">Lembur</th>
                <th className="px-4 py-3 font-bold">Catatan</th>
                <th className="px-4 py-3 font-bold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr className="border-t border-slate-100">
                  <td colSpan={7} className="px-4 py-4 text-slate-500">
                    Belum ada data absensi di periode ini.
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-700">{new Date(record.date).toLocaleDateString("id-ID")}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{record.employee?.name || "-"}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {record.checkInAt ? new Date(record.checkInAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {record.checkOutAt ? new Date(record.checkOutAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">{record.overtimeMinutes || 0}</td>
                    <td className="px-4 py-3 text-slate-600">{record.notes || "-"}</td>
                    <td className="px-4 py-3 text-right">
                      <form action={deleteAttendanceRecord}>
                        <input type="hidden" name="id" value={record.id} />
                        <button className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100">
                          Delete
                        </button>
                      </form>
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
