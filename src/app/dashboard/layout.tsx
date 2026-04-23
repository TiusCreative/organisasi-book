import DashboardLayout from "@/components/DashboardLayout"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic';

export default async function DashboardLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  let currentUser
  try {
    currentUser = await getCurrentUser()
  } catch (error) {
    console.error("Dashboard Layout: Error getting current user:", error)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800 mb-4">Error Loading Dashboard</h1>
          <p className="text-slate-600 mb-6">Terjadi kesalahan saat memuat data user. Silakan login kembali.</p>
          <Link
            href="/login"
            className="inline-flex items-center rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Kembali ke Login
          </Link>
        </div>
      </div>
    )
  }
  
  let organizationName = undefined
  if (currentUser?.organizationId) {
    try {
      const organization = await prisma.organization.findUnique({
        where: { id: currentUser.organizationId },
        select: { name: true }
      })
      organizationName = organization?.name
    } catch (error) {
      console.error("Dashboard Layout: Error fetching organization:", error)
      // Continue without organization name if fetch fails
    }
  }

  return (
    <DashboardLayout
      currentUser={
        currentUser
          ? {
              name: currentUser.name,
              role: currentUser.role,
              permissions: currentUser.permissions,
              isPlatformAdmin: currentUser.isPlatformAdmin,
              organizationName
            }
          : null
      }
    >
      {children}
    </DashboardLayout>
  )
}
