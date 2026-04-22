import DashboardLayout from "@/components/DashboardLayout"
import { getCurrentUser } from "@/lib/auth"

export const dynamic = 'force-dynamic';

export default async function DashboardLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  const currentUser = await getCurrentUser()

  return (
    <DashboardLayout
      currentUser={
        currentUser
          ? {
              name: currentUser.name,
              role: currentUser.role,
              permissions: currentUser.permissions,
              isPlatformAdmin: currentUser.isPlatformAdmin,
            }
          : null
      }
    >
      {children}
    </DashboardLayout>
  )
}
