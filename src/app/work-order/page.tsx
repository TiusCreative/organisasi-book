import { requireCurrentOrganization, requireModuleAccess } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getWorkOrders } from "@/app/actions/work-order"
import WorkOrderManager from "@/components/work-order/WorkOrderManager"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default async function WorkOrderPage() {
  await requireModuleAccess("workOrder")
  const { organization } = await requireCurrentOrganization()

  const workOrders = await getWorkOrders(organization.id)
  const [users, customers, inventoryItems, boms] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: organization.id },
      select: { id: true, name: true, email: true }
    }),
    prisma.customer.findMany({
      where: { organizationId: organization.id },
      select: { id: true, name: true, code: true }
    }),
    prisma.inventoryItem.findMany({
      where: { organizationId: organization.id, status: "ACTIVE" },
      select: { id: true, code: true, name: true, unit: true, unitCost: true, quantity: true, itemType: true },
      orderBy: { code: "asc" },
    }),
    prisma.billOfMaterial.findMany({
      where: { organizationId: organization.id, isActive: true },
      select: { id: true, code: true, name: true, version: true, productItemId: true },
      orderBy: [{ code: "asc" }, { version: "desc" }],
    }),
  ])

  return (
    <div className="max-w-6xl mx-auto py-10">
      <div className="mb-6">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors">
          <ArrowLeft size={20} />
          <span>Kembali ke Dashboard</span>
        </Link>
      </div>
      <h1 className="text-2xl font-bold mb-2 text-blue-700">Work Order</h1>
      <p className="mb-6 text-sm text-slate-500">Organisasi aktif: {organization.name}</p>
      <WorkOrderManager 
        initialWorkOrders={workOrders} 
        users={users}
        customers={customers}
        inventoryItems={inventoryItems}
        boms={boms}
        organizationId={organization.id}
      />
    </div>
  )
}
