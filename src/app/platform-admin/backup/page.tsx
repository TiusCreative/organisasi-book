import Link from "next/link"
import { ArrowLeft, Database, Download, Upload, Trash2, RefreshCw, FileText, Table2, Code, BarChart3, AlertTriangle } from "lucide-react"
import { requirePlatformAdmin } from "../../../lib/auth"
import { prisma } from "../../../lib/prisma"
import BackupActions from "../../../components/platform-admin/BackupActions"
import DatabaseSchemaViewer from "../../../components/platform-admin/DatabaseSchemaViewer"
import DatabaseStats from "../../../components/platform-admin/DatabaseStats"

export const metadata = {
  title: "Backup & Restore - Platform Admin",
  description: "Database backup, restore, and schema management",
}

export default async function BackupRestorePage() {
  await requirePlatformAdmin()

  // Get database stats
  const stats = await prisma.$transaction([
    prisma.user.count(),
    prisma.organization.count(),
    prisma.transaction.count(),
    prisma.chartOfAccount.count(),
    prisma.employee.count(),
    prisma.invoice.count(),
    prisma.vendorBill.count(),
    prisma.inventoryItem.count(),
    prisma.salesOrder.count(),
  ])

  const databaseStats = {
    users: stats[0],
    organizations: stats[1],
    transactions: stats[2],
    accounts: stats[3],
    employees: stats[4],
    invoices: stats[5],
    vendorBills: stats[6],
    inventoryItems: stats[7],
    salesOrders: stats[8],
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-0">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Backup & Restore Database</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kelola backup database, restore data, dan lihat skema Prisma lengkap dengan diagram SQL untuk Supabase.
          </p>
        </div>
        <Link
          href="/platform-admin"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
        >
          <ArrowLeft size={18} />
          Kembali ke Platform Admin
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <Database className="text-blue-600" size={24} />
          <p className="mt-3 text-sm text-slate-500">Total Organisasi</p>
          <p className="text-2xl font-bold text-slate-800">{databaseStats.organizations.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <Table2 className="text-emerald-600" size={24} />
          <p className="mt-3 text-sm text-slate-500">Total Transaksi</p>
          <p className="text-2xl font-bold text-slate-800">{databaseStats.transactions.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <BarChart3 className="text-purple-600" size={24} />
          <p className="mt-3 text-sm text-slate-500">Total Users</p>
          <p className="text-2xl font-bold text-slate-800">{databaseStats.users.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <FileText className="text-amber-600" size={24} />
          <p className="mt-3 text-sm text-slate-500">Total Invoices</p>
          <p className="text-2xl font-bold text-slate-800">{databaseStats.invoices.toLocaleString()}</p>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 text-amber-600" size={20} />
          <div>
            <h3 className="font-semibold text-amber-900">Peringatan Penting</h3>
            <p className="mt-1 text-sm text-amber-800">
              Operasi backup dan restore database dapat memengaruhi seluruh data sistem. 
              Pastikan untuk selalu membuat backup sebelum melakukan restore. 
              Restore akan menimpa data yang ada dan tidak dapat dibatalkan.
            </p>
          </div>
        </div>
      </div>

      {/* Backup Actions */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-lg bg-blue-100 p-2">
            <Database className="text-blue-600" size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Backup & Restore</h2>
            <p className="text-sm text-slate-500">Buat backup, restore database, dan kelola file backup</p>
          </div>
        </div>
        <BackupActions />
      </div>

      {/* Database Schema */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-lg bg-purple-100 p-2">
            <Code className="text-purple-600" size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Skema Database</h2>
            <p className="text-sm text-slate-500">Prisma schema lengkap dengan diagram SQL untuk Supabase</p>
          </div>
        </div>
        <DatabaseSchemaViewer />
      </div>

      {/* Database Stats Detail */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-lg bg-emerald-100 p-2">
            <BarChart3 className="text-emerald-600" size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Statistik Database</h2>
            <p className="text-sm text-slate-500">Ringkasan jumlah data per tabel utama</p>
          </div>
        </div>
        <DatabaseStats stats={databaseStats} />
      </div>
    </div>
  )
}
