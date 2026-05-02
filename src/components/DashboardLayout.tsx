"use client"

import { useState, useTransition } from 'react'
import { Menu, X, LayoutDashboard, ReceiptText, FileBarChart, Settings, Building2, ChevronDown, ChevronRight, Landmark, Users, Package, LineChart, BadgePercent, Shield, FileText, Clock, Wrench, Boxes, Target, UserCheck, Truck, DollarSign, PieChart, TrendingUp, Briefcase, Wallet, ShoppingCart } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { logoutUser } from '../app/actions/auth'
import { hasModulePermission, type ModulePermission } from '../lib/permissions'

// Menu item types
interface MenuItem {
  name: string
  icon: React.ElementType
  href: string
  permission: ModulePermission
}

interface MenuGroup {
  name: string
  icon: React.ElementType
  permission: ModulePermission
  items: MenuItem[]
}

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
    organizationName?: string
  } | null
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['pos', 'laporan'])
  const [isPending, startTransition] = useTransition()
  const pathname = usePathname()
  const router = useRouter()

  if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
    return <>{children}</>
  }

  // Single menu items (non-grouped)
  const singleMenuItems: MenuItem[] = [
    { name: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', permission: 'dashboard' as ModulePermission },
    { name: 'Transaksi', icon: ReceiptText, href: '/transaksi', permission: 'transactions' as ModulePermission },
    { name: 'AR/AP', icon: FileText, href: '/arap', permission: 'arap' as ModulePermission },
    { name: 'Purchase Order', icon: FileText, href: '/po', permission: 'arap' as ModulePermission },
    { name: 'Rekening Bank', icon: Landmark, href: '/bank', permission: 'bank' as ModulePermission },
    { name: 'Customer', icon: UserCheck, href: '/customer', permission: 'customer' as ModulePermission },
    { name: 'Supplier', icon: Truck, href: '/supplier', permission: 'supplier' as ModulePermission },
    { name: 'Warehouse', icon: Building2, href: '/warehouse', permission: 'warehouse' as ModulePermission },
    { name: 'Branch', icon: Building2, href: '/branch', permission: 'branch' as ModulePermission },
    { name: 'Sales Team', icon: Users, href: '/sales-team', permission: 'sales' as ModulePermission },
    { name: 'Work Order', icon: Wrench, href: '/work-order', permission: 'workOrder' as ModulePermission },
    { name: 'Sales / Marketing', icon: Target, href: '/sales', permission: 'sales' as ModulePermission },
    { name: 'Inventory', icon: Boxes, href: '/inventory', permission: 'inventory' as ModulePermission },
    { name: 'Budget', icon: DollarSign, href: '/budget', permission: 'budget' as ModulePermission },
    { name: 'Investasi', icon: LineChart, href: '/investasi', permission: 'investments' as ModulePermission },
    { name: 'Daftar Akun', icon: Settings, href: '/akun', permission: 'accounts' as ModulePermission },
    { name: 'Aset', icon: Package, href: '/aset', permission: 'assets' as ModulePermission },
    { name: 'Penyusutan', icon: Settings, href: '/penyusutan', permission: 'depreciation' as ModulePermission },
    { name: 'Gaji', icon: Users, href: '/gaji', permission: 'payroll' as ModulePermission },
    { name: 'HR & GA', icon: Briefcase, href: '/hr-ga', permission: 'hrga' as ModulePermission },
    { name: 'Pajak', icon: BadgePercent, href: '/pajak', permission: 'taxes' as ModulePermission },
    { name: 'Berlangganan', icon: Shield, href: '/berlangganan', permission: 'subscription' as ModulePermission },
  ]

  // Laporan (Reports) - Grouped by category
  const reportMenuGroups: MenuGroup[] = [
    {
      name: 'Laporan Keuangan',
      icon: PieChart,
      permission: 'reportFinancial',
      items: [
        { name: 'Neraca', icon: FileBarChart, href: '/laporan/neraca', permission: 'balanceSheet' },
        { name: 'Laba Rugi', icon: TrendingUp, href: '/laporan/laba-rugi', permission: 'incomeStatement' },
        { name: 'Arus Kas', icon: Wallet, href: '/laporan/cash-flow', permission: 'cashFlow' },
        { name: 'Perubahan Modal', icon: FileText, href: '/laporan/perubahan-modal', permission: 'equityChange' },
        { name: 'Laba Ditahan', icon: FileText, href: '/laporan/laba-ditahan', permission: 'retainedEarnings' },
        { name: 'Cadangan & Distribusi', icon: FileText, href: '/laporan/cadangan-distribusi', permission: 'reservesDistribution' },
        { name: 'Buku Besar', icon: FileText, href: '/laporan/buku-besar', permission: 'generalLedger' },
      ]
    },
    {
      name: 'Laporan Operasional',
      icon: Briefcase,
      permission: 'reportOperational',
      items: [
        { name: 'AR/AP', icon: FileText, href: '/laporan/arap', permission: 'arap' },
        { name: 'Purchase Order', icon: FileText, href: '/laporan/po', permission: 'reportPurchase' },
        { name: 'Sales & Marketing', icon: Target, href: '/sales', permission: 'reportSales' },
        { name: 'Inventory & Gudang', icon: Boxes, href: '/inventory', permission: 'reportInventory' },
      ]
    },
    {
      name: 'Laporan Aset & Investasi',
      icon: LineChart,
      permission: 'reportAssets',
      items: [
        { name: 'Aset Tak Berwujud', icon: FileText, href: '/laporan/aset-tak-berwujud', permission: 'intangibleAssets' },
        { name: 'Investasi', icon: LineChart, href: '/laporan/investasi', permission: 'investmentReport' },
      ]
    },
    {
      name: 'Laporan Pajak',
      icon: BadgePercent,
      permission: 'reportTax',
      items: [
        { name: 'Pajak', icon: BadgePercent, href: '/pajak', permission: 'taxes' },
      ]
    },
    {
      name: 'Laporan Bank',
      icon: Landmark,
      permission: 'reportBank',
      items: [
        { name: 'Rekening Bank', icon: FileText, href: '/laporan/bank', permission: 'bankReport' },
      ]
    },
  ]

  const posMenuItems: MenuItem[] = [
    { name: 'Kasir Penjualan', icon: ShoppingCart, href: '/pos', permission: 'pos' },
    { name: 'Produk POS', icon: Package, href: '/pos/products', permission: 'pos' },
    { name: 'Laporan POS', icon: FileText, href: '/pos/reports', permission: 'pos' },
    { name: 'Analytics POS', icon: TrendingUp, href: '/pos/analytics', permission: 'pos' },
    { name: 'Pengaturan POS', icon: Settings, href: '/pos/settings', permission: 'pos' },
  ]

  // Filter visible items - show all if permissions check fails (fallback)
  const visibleSingleMenuItems = currentUser
    ? singleMenuItems.filter((item) => {
        try {
          return hasModulePermission(currentUser, item.permission)
        } catch (e) {
          console.warn(`Permission check failed for ${item.permission}:`, e)
          return true // Fallback: show menu if permission check fails
        }
      })
    : []

  const visibleReportGroups = currentUser
    ? reportMenuGroups
        .map(group => ({
          ...group,
          items: group.items.filter(item => {
            try {
              return hasModulePermission(currentUser, item.permission)
            } catch (e) {
              console.warn(`Permission check failed for ${item.permission}:`, e)
              return true
            }
          })
        }))
        .filter(group => {
          try {
            return group.items.length > 0 && hasModulePermission(currentUser, group.permission)
          } catch (e) {
            console.warn(`Permission check failed for ${group.permission}:`, e)
            return group.items.length > 0
          }
        })
    : []

  const hasAnyReportAccess = visibleReportGroups.length > 0

  const visiblePosMenuItems = currentUser
    ? posMenuItems.filter((item) => hasModulePermission(currentUser, item.permission))
    : []
  const isInPosSection = pathname === '/pos' || pathname.startsWith('/pos/')

  const organizationAdminMenuItems = currentUser
    ? [
        { name: 'Audit Trail', icon: Clock, href: '/audit-trail', permission: 'auditTrail' as ModulePermission },
        { name: 'Admin Organisasi', icon: Shield, href: '/admin', permission: 'organizationAdmin' as ModulePermission },
        { name: 'Pengaturan Organisasi', icon: Settings, href: '/pengaturan', permission: 'organizationSettings' as ModulePermission },
      ].filter((item) => {
        try {
          return hasModulePermission(currentUser, item.permission)
        } catch (e) {
          console.warn(`Permission check failed for ${item.permission}:`, e)
          return true
        }
      })
    : []

  const platformAdminMenuItems = currentUser?.isPlatformAdmin
    ? [
        { name: 'Platform Admin', icon: Shield, href: '/platform-admin', permission: 'platformAdmin' as ModulePermission },
        { name: 'Backup & Restore', icon: FileText, href: '/platform-admin/backup', permission: 'backupRestore' as ModulePermission },
      ]
    : []

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => 
      prev.includes(groupName) 
        ? prev.filter(g => g !== groupName)
        : [...prev, groupName]
    )
  }

  const isInReportSection = pathname.startsWith('/laporan') || 
    (pathname.startsWith('/sales') && visibleReportGroups.some(g => g.items.some(i => i.href === '/sales'))) ||
    (pathname.startsWith('/inventory') && visibleReportGroups.some(g => g.items.some(i => i.href === '/inventory'))) ||
    (pathname.startsWith('/pajak') && visibleReportGroups.some(g => g.items.some(i => i.href === '/pajak')))

  const isActiveHref = (href: string) => {
    if (href === '/pos') return pathname === href
    return pathname === href || pathname.startsWith(`${href}/`)
  }

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
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white shadow-xl transform transition-transform duration-300 ease-in-out pointer-events-auto md:relative md:translate-x-0 overflow-y-auto ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-12 px-6 bg-slate-950 border-b border-slate-800">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 font-bold text-lg tracking-tight text-white">
              <Building2 className="text-blue-500" size={18} />
              <span>OrgBook</span>
            </div>
            {currentUser?.organizationName && (
              <span className="text-xs text-slate-400 mt-0.5">{currentUser.organizationName}</span>
            )}
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <nav className="p-4 space-y-1.5">
          {/* Single Menu Items */}
          {visibleSingleMenuItems.map((item) => {
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

          {visiblePosMenuItems.length > 0 && (
            <div className="pt-2">
              <button
                onClick={() => toggleGroup('pos')}
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg transition-colors font-medium pointer-events-auto ${
                  isInPosSection
                    ? 'bg-blue-600/20 text-blue-300'
                    : 'text-gray-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <ShoppingCart size={20} className={isInPosSection ? 'text-blue-300' : 'text-gray-400'} />
                  <span>POS / Kasir</span>
                </div>
                {expandedGroups.includes('pos') ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>

              {expandedGroups.includes('pos') && (
                <div className="mt-1 ml-4 space-y-1 border-l-2 border-slate-700 pl-3">
                  {visiblePosMenuItems.map((item) => {
                    const isActive = isActiveHref(item.href)
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setIsSidebarOpen(false)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                          isActive
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-400 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <item.icon size={16} />
                        <span>{item.name}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Grouped Reports Menu */}
          {hasAnyReportAccess && (
            <div className="pt-2">
              <button
                onClick={() => toggleGroup('laporan')}
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg transition-colors font-medium pointer-events-auto ${
                  isInReportSection
                    ? 'bg-blue-600/20 text-blue-300'
                    : 'text-gray-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <FileBarChart size={20} className={isInReportSection ? 'text-blue-300' : 'text-gray-400'} />
                  <span>Laporan</span>
                </div>
                {expandedGroups.includes('laporan') ? (
                  <ChevronDown size={16} />
                ) : (
                  <ChevronRight size={16} />
                )}
              </button>
              
              {expandedGroups.includes('laporan') && (
                <div className="mt-1 ml-4 space-y-1 border-l-2 border-slate-700 pl-3">
                  {visibleReportGroups.map((group) => (
                    <div key={group.name} className="space-y-1">
                      <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <group.icon size={14} />
                        <span>{group.name}</span>
                      </div>
                      {group.items.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
                        return (
                          <Link
                            key={item.name}
                            href={item.href}
                            onClick={() => setIsSidebarOpen(false)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                              isActive
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-400 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            <item.icon size={16} />
                            <span>{item.name}</span>
                          </Link>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
