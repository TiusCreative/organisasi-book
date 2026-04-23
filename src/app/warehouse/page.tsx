import { requireModuleAccess } from "@/lib/auth"
import WarehouseModule from "@/components/warehouse/WarehouseModule"
import { getWarehouseLocations, getWarehouseModuleBootstrap, getWarehouseReportData } from "@/app/actions/warehouse-module"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default async function WarehousePage() {
  const { organization } = await requireModuleAccess("warehouse")

  const boot = await getWarehouseModuleBootstrap()
  const today = new Date()
  const start = new Date(today)
  start.setDate(start.getDate() - 30)

  const [report, locations] = await Promise.all([
    getWarehouseReportData({
      startDate: start.toISOString().slice(0, 10),
      endDate: today.toISOString().slice(0, 10),
    }),
    getWarehouseLocations({}),
  ])

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors">
          <ArrowLeft size={20} />
          <span>Kembali ke Dashboard</span>
        </Link>
      </div>
      <WarehouseModule
        organizationId={organization.id}
        organizationName={organization.name}
        warehouses={boot.warehouses as any}
        users={boot.users as any}
        accounts={(boot as any).accounts || []}
        accountingConfig={(boot as any).accountingConfig || null}
        initialItems={report.items as any}
        initialMovements={report.movements as any}
        initialStockOpnames={report.stockOpnames as any}
        initialTransferOrders={(report as any).transferOrders || []}
        initialLocations={locations as any}
      />
    </div>
  )
}
