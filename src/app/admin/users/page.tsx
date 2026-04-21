import UserManagement from "../../../components/admin/UserManagement"
import { requireCurrentOrganization, requireModuleAccess, requireOrganizationAdmin } from "../../../lib/auth"
import { prisma } from "../../../lib/prisma"

export default async function UsersAdminPage() {
  await requireModuleAccess("organizationAdmin", { allowExpired: true })
  const admin = await requireOrganizationAdmin({ allowExpired: true })
  const { organization } = await requireCurrentOrganization({ allowExpired: true })

  const users = await prisma.user.findMany({
    where: { organizationId: admin.organizationId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      permissions: true,
      status: true,
      organizationId: true,
    },
  })

  return (
    <div className="max-w-4xl mx-auto py-10">
      <h1 className="text-2xl font-bold mb-2 text-blue-700">Manajemen User</h1>
      <p className="mb-6 text-sm text-slate-500">Organisasi aktif: {organization.name}</p>
      <UserManagement initialUsers={users} organizations={[{ id: organization.id, name: organization.name }]} />
    </div>
  )
}
