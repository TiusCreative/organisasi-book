"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requireCurrentOrganization } from "@/lib/auth"
import { hasModulePermission } from "@/lib/permissions"

export async function getSalesTeam() {
  const { organization } = await requireCurrentOrganization()
  
  const users = await prisma.user.findMany({
    where: {
      organizationId: organization.id,
      permissions: {
        has: "sales"
      }
    },
    include: {
      salesOrdersAssigned: {
        select: {
          id: true,
          code: true,
          status: true,
          totalAmount: true,
          orderDate: true
        },
        orderBy: { orderDate: 'desc' },
        take: 5
      },
      commissionsReceived: {
        select: {
          id: true,
          totalCommission: true,
          status: true,
          paidAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      }
    },
    orderBy: { name: 'asc' }
  })

  return users
}

export async function addSalesPermission(userId: string) {
  const { user } = await requireCurrentOrganization()

  if (!hasModulePermission(user, "organizationAdmin")) {
    throw new Error("Anda tidak memiliki izin untuk menambahkan sales person")
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId }
  })

  if (!targetUser) {
    throw new Error("User tidak ditemukan")
  }

  const currentPermissions = targetUser.permissions as string[]
  if (!currentPermissions.includes("sales")) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        permissions: [...currentPermissions, "sales"]
      }
    })
  }

  revalidatePath("/sales-team")
  revalidatePath("/sales")
}

export async function removeSalesPermission(userId: string) {
  const { user } = await requireCurrentOrganization()

  if (!hasModulePermission(user, "organizationAdmin")) {
    throw new Error("Anda tidak memiliki izin untuk menghapus sales person")
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId }
  })

  if (!targetUser) {
    throw new Error("User tidak ditemukan")
  }

  const currentPermissions = targetUser.permissions as string[]
  await prisma.user.update({
    where: { id: userId },
    data: {
      permissions: currentPermissions.filter(p => p !== "sales")
    }
  })

  revalidatePath("/sales-team")
  revalidatePath("/sales")
}

export async function getOrganizationUsers() {
  const { organization } = await requireCurrentOrganization()
  
  return await prisma.user.findMany({
    where: { organizationId: organization.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      permissions: true
    },
    orderBy: { name: 'asc' }
  })
}
