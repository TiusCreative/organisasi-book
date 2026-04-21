import { prisma } from "../../lib/prisma"
import { Plus, Edit2, Eye } from "lucide-react"
import Link from "next/link"
import { requireModuleAccess } from "../../lib/auth"

export default async function GajiPage() {
  const { organization: activeOrg } = await requireModuleAccess("payroll")

  if (!activeOrg) {
    return (
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-800">Gaji Karyawan</h1>
        <p className="text-slate-500 mt-2">Belum ada organisasi. Silakan buat organisasi terlebih dahulu.</p>
      </div>
    )
  }

  const employees = await prisma.employee.findMany({
    where: { organizationId: activeOrg.id },
    include: {
      salarySlips: {
        orderBy: { createdAt: 'desc' },
        take: 1
      },
      allowances: {
        where: { endDate: null }
      },
      deductions: {
        where: { endDate: null }
      }
    },
    orderBy: { name: 'asc' }
  })

  return (
    <div className="max-w-full lg:max-w-6xl mx-auto px-4 sm:px-0 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Manajemen Gaji</h1>
          <p className="text-slate-500 text-sm mt-1">Kelola karyawan dan slip gaji</p>
        </div>
        <Link
          href="/gaji/tambah"
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold text-sm"
        >
          <Plus size={20} /> Tambah Karyawan
        </Link>
      </div>

      {/* Employees List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {employees.length === 0 ? (
          <div className="text-center py-12 sm:py-16">
            <p className="text-slate-500 font-bold text-base sm:text-lg">Belum Ada Karyawan</p>
            <p className="text-slate-400 text-sm mt-1">Mulai dengan menambahkan data karyawan</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-left text-xs sm:text-sm font-bold text-slate-700">
                  <th className="px-4 sm:px-6 py-3">Nama</th>
                  <th className="hidden sm:table-cell px-4 sm:px-6 py-3">Jabatan</th>
                  <th className="hidden md:table-cell px-4 sm:px-6 py-3">Gaji Pokok</th>
                  <th className="hidden lg:table-cell px-4 sm:px-6 py-3">Status</th>
                  <th className="px-4 sm:px-6 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 sm:px-6 py-4">
                      <div>
                        <p className="font-bold text-slate-800 text-sm sm:text-base">{emp.name}</p>
                        <p className="text-xs sm:text-sm text-slate-500 sm:hidden">{emp.position}</p>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-4 sm:px-6 py-4 text-sm text-slate-700">
                      {emp.position}
                    </td>
                    <td className="hidden md:table-cell px-4 sm:px-6 py-4 font-mono font-bold text-slate-800 text-sm">
                      Rp {emp.baseSalary.toLocaleString('id-ID')}
                    </td>
                    <td className="hidden lg:table-cell px-4 sm:px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                        emp.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-700'
                          : emp.status === 'INACTIVE'
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {emp.status === 'ACTIVE' ? 'Aktif' : emp.status === 'INACTIVE' ? 'Nonaktif' : 'Cuti'}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-right">
                      <div className="flex flex-col sm:flex-row gap-2 justify-end">
                        <Link
                          href={`/gaji/${emp.id}`}
                          className="inline-flex items-center justify-center gap-1 px-2 py-1 text-blue-600 hover:bg-blue-50 rounded text-xs sm:text-sm font-medium transition-colors"
                        >
                          <Eye size={16} /> Lihat
                        </Link>
                        <Link
                          href={`/gaji/${emp.id}/edit`}
                          className="inline-flex items-center justify-center gap-1 px-2 py-1 text-slate-600 hover:bg-slate-100 rounded text-xs sm:text-sm font-medium transition-colors"
                        >
                          <Edit2 size={16} /> Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stats */}
      {employees.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-100 shadow-sm">
            <p className="text-slate-500 text-xs sm:text-sm font-bold">Total Karyawan</p>
            <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-2">{employees.length}</p>
          </div>
          <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-100 shadow-sm">
            <p className="text-slate-500 text-xs sm:text-sm font-bold">Aktif</p>
            <p className="text-2xl sm:text-3xl font-bold text-green-600 mt-2">
              {employees.filter(e => e.status === 'ACTIVE').length}
            </p>
          </div>
          <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-100 shadow-sm">
            <p className="text-slate-500 text-xs sm:text-sm font-bold">Total Gaji Pokok</p>
            <p className="text-lg sm:text-2xl font-bold text-slate-800 mt-2 font-mono">
              Rp {employees.reduce((sum, e) => sum + e.baseSalary, 0).toLocaleString('id-ID')}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
