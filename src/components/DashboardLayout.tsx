"use client"

import { useState, useTransition } from 'react'
import { Menu, X, LayoutDashboard, ReceiptText, FileBarChart, Settings, Building2, ChevronDown, Landmark, Users, Package, LineChart, BadgePercent, Shield, FileText, Clock, Wrench, Boxes, Target, UserCheck, Truck, DollarSign } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { logoutUser } from '../app/actions/auth'
import { hasModulePermission } from '../lib/permissions'

export default function DashboardLayout({
  children,
  currentUser,
}: {
  children: React.ReactNode
  currentUser: {
    name: string
    role: "ADMIN" | "MANAGER" | "STAFF" | "VIEWER"
    permissions: string[]
    isPlatformAdmin: boolean
  } | null
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const pathname = usePathname() // Untuk mendeteksi kita sedang di halaman mana
  const router = useRouter()

  if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
    return <>{children}</>
  }

  const appMenuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', permission: 'dashboard' },
    { name: 'Transaksi', icon: ReceiptText, href: '/transaksi', permission: 'transactions' },
    { name: 'AR/AP', icon: FileText, href: '/arap', permission: 'arap' },
    { name: 'Purchase Order', icon: FileText, href: '/po', permission: 'arap' },
    { name: 'Rekening Bank', icon: Landmark, href: '/bank', permission: 'bank' },
    { name: 'Customer', icon: UserCheck, href: '/customer', permission: 'customer' },
    { name: 'Supplier', icon: Truck, href: '/supplier', permission: 'supplier' },
    { name: 'Warehouse', icon: Building2, href: '/warehouse', permission: 'warehouse' },
    { name: 'Branch', icon: Building2, href: '/branch', permission: 'branch' },
    { name: 'Sales Team', icon: Users, href: '/sales-team', permission: 'sales' },
    { name: 'Work Order', icon: Wrench, href: '/work-order', permission: 'workOrder' },
    { name: 'Sales / Marketing', icon: Target, href: '/sales', permission: 'sales' },
    { name: 'Inventory', icon: Boxes, href: '/inventory', permission: 'inventory' },
    { name: 'Budget', icon: DollarSign, href: '/budget', permission: 'reports' },
    { name: 'Investasi', icon: LineChart, href: '/investasi', permission: 'investments' },
    { name: 'Laporan', icon: FileBarChart, href: '/laporan', permission: 'reports' },
    { name: 'Daftar Akun', icon: Settings, href: '/akun', permission: 'accounts' },
    { name: 'Aset', icon: Package, href: '/aset', permission: 'assets' },
    { name: 'Penyusutan', icon: Settings, href: '/penyusutan', permission: 'depreciation' },
    { name: 'Gaji', icon: Users, href: '/gaji', permission: 'payroll' },
    { name: 'Pajak', icon: BadgePercent, href: '/pajak', permission: 'taxes' },
    { name: 'Berlangganan', icon: Shield, href: '/berlangganan', permission: 'subscription' },
  ] as const
  const visibleAppMenuItems = currentUser
    ? appMenuItems.filter((item) => hasModulePermission(currentUser, item.permission))
    : []

  const organizationAdminMenuItems = currentUser
    ? [
        { name: 'Audit Trail', icon: Clock, href: '/audit-trail', permission: 'auditTrail' },
        { name: 'Admin Organisasi', icon: Shield, href: '/admin', permission: 'organizationAdmin' },
        { name: 'Pengaturan Organisasi', icon: Settings, href: '/pengaturan', permission: 'organizationSettings' },
      ].filter((item) => hasModulePermission(currentUser, item.permission))
    : []
  const platformAdminMenuItems = currentUser?.isPlatformAdmin
    ? [{ name: 'Platform Admin', icon: Shield, href: '/platform-admin' }]
    : []

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* OVERLAY MOBILE */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR NAVIGATION */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white shadow-xl transform transition-transform duration-300 ease-in-out pointer-events-auto md:relative md:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-6 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-white">
            <Building2 className="text-blue-500" size={24} />
            <span>OrgBook</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <nav className="p-4 space-y-1.5">
          {visibleAppMenuItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link 
                key={item.name} 
                href={item.href}
                onClick={() => setIsSidebarOpen(false)} // Tutup sidebar di mobile jika diklik
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium pointer-events-auto ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-md' // Menyala biru jika aktif
                    : 'text-gray-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <item.icon size={20} className={isActive ? 'text-white' : 'text-gray-400'} />
                <span>{item.name}</span>
              </Link>
            )
          })}

          {organizationAdminMenuItems.length > 0 && (
            <div className="pt-4">
              <p className="px-4 pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Admin Organisasi
              </p>
              <div className="space-y-1.5">
                {organizationAdminMenuItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsSidebarOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium pointer-events-auto ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'text-gray-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <item.icon size={20} className={isActive ? 'text-white' : 'text-gray-400'} />
                      <span>{item.name}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {platformAdminMenuItems.length > 0 && (
            <div className="pt-4">
              <p className="px-4 pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Internal Platform
              </p>
              <div className="space-y-1.5">
                {platformAdminMenuItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsSidebarOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium pointer-events-auto ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'text-gray-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <item.icon size={20} className={isActive ? 'text-white' : 'text-gray-400'} />
                      <span>{item.name}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </nav>
      </aside>

      {/* AREA KONTEN UTAMA */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Navbar Atas dengan Switcher Organisasi */}
        <header className="h-16 bg-white shadow-sm border-b border-gray-200 flex items-center px-4 md:px-8 justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)} 
              className="md:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100"
            >
              <Menu size={24} />
            </button>
            
            {/* SWITCHER ORGANISASI */}
            <div className="hidden sm:flex items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-gray-100 transition">
              <div className="w-6 h-6 bg-blue-100 text-blue-700 rounded mr-2 flex items-center justify-center font-bold text-xs">Y</div>
              <select className="bg-transparent font-semibold text-gray-700 text-sm focus:outline-none cursor-pointer appearance-none pr-4">
                <option value="yayasan">Yayasan Peduli Umat</option>
                <option value="perorangan">Perusahaan Perorangan (PT/CV)</option>
              </select>
              <ChevronDown size={16} className="text-gray-500 -ml-2" />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <span className="text-sm font-medium text-gray-600 hidden md:block">
              Halo, {currentUser?.name || "User"}
             </span>
             <button
                onClick={() => {
                  startTransition(async () => {
                    await logoutUser()
                    router.push("/login")
                    router.refresh()
                  })
                }}
                className="hidden md:inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                {isPending ? "Keluar..." : "Logout"}
             </button>
             <div className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-sm shadow-inner">
                {(currentUser?.name || "A").slice(0, 1).toUpperCase()}
             </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
