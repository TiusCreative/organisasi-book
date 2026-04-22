import { requireCurrentOrganization, requireModuleAccess } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getWorkOrders } from "@/app/actions/work-order"
import WorkOrderManager from "@/components/work-order/WorkOrderManager"

export default async function WorkOrderPage() {
  await requireModuleAccess("workOrder")
  const { organization } = await requireCurrentOrganization()

  const workOrders = await getWorkOrders(organization.id)
  const users = await prisma.user.findMany({
    where: { organizationId: organization.id },
    select: { id: true, name: true, email: true }
  })
  const customers = await prisma.customer.findMany({
    where: { organizationId: organization.id },
    select: { id: true, name: true, code: true }
  })

  return (
    <div className="max-w-6xl mx-auto py-10">
      <h1 className="text-2xl font-bold mb-2 text-blue-700">Work Order</h1>
      <p className="mb-6 text-sm text-slate-500">Organisasi aktif: {organization.name}</p>
      <WorkOrderManager 
        initialWorkOrders={workOrders} 
        users={users}
        customers={customers}
        organizationId={organization.id}
      />
    </div>
  )
}
