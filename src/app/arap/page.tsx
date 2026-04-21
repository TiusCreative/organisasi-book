import { Users, FileText, Receipt } from "lucide-react"
import { requireCurrentOrganization, requireModuleAccess } from "../../lib/auth"
import CustomerSupplierManager from "../../components/arap/CustomerSupplierManager"
import InvoiceManager from "../../components/arap/InvoiceManager"
import VendorBillManager from "../../components/arap/VendorBillManager"

export default async function ARAPPage() {
  await requireModuleAccess("arap")
  const { organization: activeOrg } = await requireCurrentOrganization()

  if (!activeOrg) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-0">
        <h1 className="text-2xl font-bold text-slate-800">AR/AP</h1>
        <p className="text-slate-500 mt-2">Belum ada organisasi. Silakan buat organisasi terlebih dahulu.</p>
      </div>
    )
  }

  return (
    <div className="max-w-full lg:max-w-7xl mx-auto px-4 sm:px-0 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">AR/AP</h1>
        <p className="text-slate-500 text-sm mt-1">Kelola Account Receivable dan Account Payable</p>
      </div>

      {/* Customer & Supplier */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-3 flex-col sm:flex-row">
          <Users size={24} className="text-blue-600" />
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800">Customer & Supplier</h2>
            <p className="text-xs sm:text-sm text-slate-500">Kelola data pelanggan dan supplier</p>
          </div>
        </div>
        <CustomerSupplierManager organizationId={activeOrg.id} />
      </div>

      {/* Invoices */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-3 flex-col sm:flex-row">
          <FileText size={24} className="text-emerald-600" />
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800">Invoice (Account Receivable)</h2>
            <p className="text-xs sm:text-sm text-slate-500">Kelola invoice penjualan kepada customer</p>
          </div>
        </div>
        <InvoiceManager organizationId={activeOrg.id} />
      </div>

      {/* Vendor Bills */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-3 flex-col sm:flex-row">
          <Receipt size={24} className="text-orange-600" />
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800">Vendor Bill (Account Payable)</h2>
            <p className="text-xs sm:text-sm text-slate-500">Kelola tagihan dari supplier</p>
          </div>
        </div>
        <VendorBillManager organizationId={activeOrg.id} />
      </div>
    </div>
  )
}
