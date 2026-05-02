"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  BarChart2,
  Boxes,
  Building2,
  ClipboardCheck,
  FileText,
  Landmark,
  Menu,
  Package,
  ReceiptText,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Tags,
  Truck,
  UserCheck,
  Wallet,
  X,
} from "lucide-react"

const posMenuGroups = [
  {
    title: "Kasir",
    items: [
      { href: "/pos", label: "Kasir Penjualan", icon: ShoppingCart },
      { href: "/pos/reports", label: "Laporan POS", icon: FileText },
      { href: "/pos/analytics", label: "Dashboard POS", icon: BarChart2 },
      { href: "/pos/settings", label: "Pengaturan POS", icon: Settings },
    ],
  },
  {
    title: "Produk & Stok",
    items: [
      { href: "/pos/products", label: "Barang / Produk", icon: Package },
      { href: "/inventory", label: "Kategori Barang", icon: Tags },
      { href: "/inventory", label: "Manajemen Stok", icon: Boxes },
      { href: "/warehouse", label: "Stock Opname", icon: ClipboardCheck },
    ],
  },
  {
    title: "Relasi & Pembelian",
    items: [
      { href: "/customer", label: "Pelanggan", icon: UserCheck },
      { href: "/supplier", label: "Supplier", icon: Truck },
      { href: "/po", label: "Pembelian Barang", icon: ShoppingBag },
      { href: "/arap", label: "Hutang / Piutang", icon: ReceiptText },
    ],
  },
  {
    title: "Keuangan",
    items: [
      { href: "/transaksi", label: "Diskon, Pajak & Biaya", icon: Wallet },
      { href: "/bank", label: "Kasbon / Kas Bank", icon: Landmark },
    ],
  },
]

export default function PosLayout({ children }: { children: React.ReactNode }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const pathname = usePathname()
  const menuItems = posMenuGroups.flatMap((group) => group.items)

  const isActive = (href: string) => {
    if (href === "/pos") return pathname === href
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {isMenuOpen && (
        <button
          type="button"
          aria-label="Tutup menu POS"
          className="fixed inset-0 z-40 bg-slate-950/50 md:hidden"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-200 bg-white shadow-sm md:flex">
        <div className="border-b border-slate-100 p-5">
          <div className="flex items-center gap-2">
            <Building2 className="text-blue-600" size={20} />
            <h2 className="text-xl font-bold text-blue-600">KASIR POS</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">Terhubung ke ERP, inventory, AR/AP, dan akuntansi</p>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto p-4">
          {posMenuGroups.map((group) => (
            <div key={group.title}>
              <p className="mb-2 px-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                {group.title}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <Link
                    key={`${group.title}-${item.label}`}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                      isActive(item.href)
                        ? "bg-blue-600 text-white"
                        : "text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                    }`}
                  >
                    <item.icon size={18} />
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-4">
          <Link
            href="/dashboard"
            className="flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Kembali ke ERP
          </Link>
        </div>
      </aside>

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-80 max-w-[86vw] flex-col border-r border-slate-200 bg-white shadow-xl transition-transform duration-300 md:hidden ${
          isMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between border-b border-slate-100 p-5">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="text-blue-600" size={20} />
              <h2 className="text-xl font-bold text-blue-600">KASIR POS</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">Menu kasir dan operasional toko</p>
          </div>
          <button
            type="button"
            aria-label="Tutup menu POS"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            onClick={() => setIsMenuOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto p-4">
          {posMenuGroups.map((group) => (
            <div key={`mobile-${group.title}`}>
              <p className="mb-2 px-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                {group.title}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <Link
                    key={`mobile-${group.title}-${item.label}`}
                    href={item.href}
                    onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                      isActive(item.href)
                        ? "bg-blue-600 text-white"
                        : "text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                    }`}
                  >
                    <item.icon size={18} />
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-4">
          <Link
            href="/dashboard"
            onClick={() => setIsMenuOpen(false)}
            className="flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Kembali ke ERP
          </Link>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="sticky top-0 z-30 border-b border-slate-200 bg-white px-3 py-2 md:hidden">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              aria-label="Buka menu POS"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
              onClick={() => setIsMenuOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">POS</p>
              <p className="truncate text-sm font-bold text-slate-800">
                {menuItems.find((item) => isActive(item.href))?.label || "Kasir Penjualan"}
              </p>
            </div>
            <Link
              href="/dashboard"
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              ERP
            </Link>
          </div>
        </div>
        {children}
      </main>
    </div>
  )
}
