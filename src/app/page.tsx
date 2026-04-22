import Link from "next/link"
import { Building2, TrendingUp, Shield, Users, FileText, Package, CheckCircle, ArrowRight, BarChart3, Wallet, Target } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Navigation */}
      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-lg backdrop-blur-sm">
              <Building2 size={32} className="text-white" />
            </div>
            <span className="text-2xl font-bold text-white">OrganisasiBook</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-white/80 hover:text-white transition-colors">
              Login
            </Link>
            <Link href="/register" className="bg-white text-slate-900 px-6 py-2 rounded-lg font-semibold hover:bg-blue-50 transition-colors">
              Daftar Gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full backdrop-blur-sm mb-8">
            <span className="bg-green-500 w-2 h-2 rounded-full animate-pulse"></span>
            <span className="text-white/80 text-sm">Platform Manajemen Keuangan Terlengkap</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Kelola Keuangan Organisasi Anda dengan Mudah
          </h1>
          <p className="text-xl text-white/70 mb-10 max-w-2xl mx-auto">
            Sistem akuntansi lengkap untuk yayasan dan perusahaan. Kelola transaksi, budgeting, inventory, sales, dan laporan dalam satu platform terintegrasi.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="bg-white text-slate-900 px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-50 transition-all inline-flex items-center justify-center gap-2">
              Mulai Gratis
              <ArrowRight size={20} />
            </Link>
            <Link href="/login" className="bg-white/10 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-white/20 transition-all backdrop-blur-sm border border-white/20">
              Demo
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">Fitur Lengkap</h2>
          <p className="text-white/70 text-lg">Semua yang Anda butuhkan untuk manajemen keuangan organisasi</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            { icon: BarChart3, title: "Akuntansi Lengkap", desc: "Jurnal umum, neraca, laba rugi, dan arus kas otomatis" },
            { icon: Wallet, title: "Budgeting", desc: "Budget vs actual dengan support multi-divisi" },
            { icon: Package, title: "Inventory", desc: "Manajemen stok dengan barcode, FIFO/LIFO, dan rak" },
            { icon: Target, title: "Sales & Marketing", desc: "Sales order, delivery order, invoice, dan komisi" },
            { icon: Shield, title: "Multi Warehouse", desc: "Manajemen gudang dan cabang terintegrasi" },
            { icon: FileText, title: "Laporan Otomatis", desc: "Laporan keuangan lengkap dan export PDF/Excel" },
          ].map((feature, idx) => (
            <div key={idx} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 hover:bg-white/15 transition-all">
              <div className="bg-blue-500/20 w-14 h-14 rounded-xl flex items-center justify-center mb-4">
                <feature.icon size={28} className="text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
              <p className="text-white/70">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-12">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            {[
              { value: "10K+", label: "Organisasi" },
              { value: "50K+", label: "Transaksi/Bulan" },
              { value: "99.9%", label: "Uptime" },
              { value: "24/7", label: "Support" },
            ].map((stat, idx) => (
              <div key={idx}>
                <div className="text-4xl font-bold text-white mb-2">{stat.value}</div>
                <div className="text-white/70">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-4xl font-bold text-white mb-6">Mengapa OrganisasiBook?</h2>
            <div className="space-y-6">
              {[
                "Tanpa instalasi software, semua berbasis cloud",
                "Akses dari mana saja, kapan saja",
                "Keamanan data dengan enkripsi end-to-end",
                "Otomatisasi laporan keuangan bulanan",
                "Support multi-currency dan multi-warehouse",
                "Integrasi dengan sistem payment gateway",
              ].map((benefit, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <CheckCircle size={20} className="text-green-400 mt-1 flex-shrink-0" />
                  <span className="text-white/80">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="bg-blue-500/20 w-12 h-12 rounded-xl flex items-center justify-center">
                  <Users size={24} className="text-blue-400" />
                </div>
                <div>
                  <div className="text-white font-semibold">Multi User</div>
                  <div className="text-white/60 text-sm">Role-based access control</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="bg-green-500/20 w-12 h-12 rounded-xl flex items-center justify-center">
                  <TrendingUp size={24} className="text-green-400" />
                </div>
                <div>
                  <div className="text-white font-semibold">Real-time Analytics</div>
                  <div className="text-white/60 text-sm">Dashboard interaktif</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="bg-purple-500/20 w-12 h-12 rounded-xl flex items-center justify-center">
                  <Shield size={24} className="text-purple-400" />
                </div>
                <div>
                  <div className="text-white font-semibold">Bank Grade Security</div>
                  <div className="text-white/60 text-sm">Enkripsi 256-bit</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl p-12 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">Siap Memulai?</h2>
          <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
            Daftar sekarang dan nikmati 30 hari trial gratis. Tanpa kartu kredit diperlukan.
          </p>
          <Link href="/register" className="inline-flex items-center justify-center gap-2 bg-white text-slate-900 px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-50 transition-all">
            Daftar Gratis Sekarang
            <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-12 border-t border-white/10">
        <div className="grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Building2 size={24} className="text-white" />
              <span className="text-xl font-bold text-white">OrganisasiBook</span>
            </div>
            <p className="text-white/60 text-sm">
              Platform manajemen keuangan terintegrasi untuk yayasan dan perusahaan.
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Produk</h4>
            <ul className="space-y-2 text-white/60 text-sm">
              <li><Link href="#" className="hover:text-white transition-colors">Fitur</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">Harga</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">Demo</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Perusahaan</h4>
            <ul className="space-y-2 text-white/60 text-sm">
              <li><Link href="#" className="hover:text-white transition-colors">Tentang Kami</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">Blog</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">Karir</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Support</h4>
            <ul className="space-y-2 text-white/60 text-sm">
              <li><Link href="#" className="hover:text-white transition-colors">Help Center</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">Documentation</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 mt-12 pt-8 text-center text-white/60 text-sm">
          © 2024 OrganisasiBook. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
