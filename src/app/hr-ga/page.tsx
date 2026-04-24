import Link from "next/link"
import { ClipboardList, Building2, Wallet, Wrench } from "lucide-react"
import { requireModuleAccess } from "@/lib/auth"

export default async function HrGaPage() {
  await requireModuleAccess("hrga")

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-0">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">HR & GA</h1>
        <p className="mt-1 text-sm text-slate-500">
          Modul HR (karyawan, payroll, PPh 21) dan GA (aset, maintenance) terintegrasi ke jurnal akuntansi.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/gaji" className="rounded-2xl border border-slate-200 bg-white p-6 hover:bg-slate-50">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-700">
              <Wallet size={22} />
            </div>
            <div>
              <div className="font-bold text-slate-800">Payroll</div>
              <div className="mt-1 text-sm text-slate-500">Kelola karyawan, slip gaji, potongan, tunjangan, dan jurnal gaji.</div>
            </div>
          </div>
        </Link>

        <Link href="/hr-ga/attendance" className="rounded-2xl border border-slate-200 bg-white p-6 hover:bg-slate-50">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
              <ClipboardList size={22} />
            </div>
            <div>
              <div className="font-bold text-slate-800">Time & Attendance</div>
              <div className="mt-1 text-sm text-slate-500">Catat absensi, jam masuk/keluar, dan lembur sebagai dasar payroll.</div>
            </div>
          </div>
        </Link>

        <Link href="/aset" className="rounded-2xl border border-slate-200 bg-white p-6 hover:bg-slate-50">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-amber-50 p-3 text-amber-700">
              <Building2 size={22} />
            </div>
            <div>
              <div className="font-bold text-slate-800">Fixed Assets</div>
              <div className="mt-1 text-sm text-slate-500">Pencatatan aset dan nilai buku, terhubung ke penyusutan dan jurnal.</div>
            </div>
          </div>
        </Link>

        <Link href="/hr-ga/maintenance" className="rounded-2xl border border-slate-200 bg-white p-6 hover:bg-slate-50">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-rose-50 p-3 text-rose-700">
              <Wrench size={22} />
            </div>
            <div>
              <div className="font-bold text-slate-800">Facility Management</div>
              <div className="mt-1 text-sm text-slate-500">Jadwal maintenance kendaraan/gedung/fasilitas dan tracking biaya.</div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}

