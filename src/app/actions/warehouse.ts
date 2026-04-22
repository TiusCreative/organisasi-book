"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requireCurrentOrganization } from "@/lib/auth"
import { hasModulePermission } from "@/lib/permissions"

async function generateNextWarehouseCode(tx: any, orgId: string) {
  const existingWarehouses = await tx.warehouse.findMany({
    where: { organizationId: orgId },
    select: { code: true },
    orderBy: { code: 'desc' },
    take: 1
  })

  if (existingWarehouses.length === 0) {
    return "WH-001"
  }

  const lastCode = existingWarehouses[0].code
  const lastNumber = parseInt(lastCode.split("-")[1])
  const nextNumber = lastNumber + 1
  return `WH-${String(nextNumber).padStart(3, '0')}`
}

export async function getWarehouses() {
  const { organization } = await requireCurrentOrganization()
  
  return await prisma.warehouse.findMany({
    where: { organizationId: organization.id },
    include: {
      manager: {
        select: { id: true, name: true, email: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  })
}

export async function createWarehouse(formData: FormData) {
  const { user, organization } = await requireCurrentOrganization()

  if (!hasModulePermission(user, "warehouse")) {
    throw new Error("Anda tidak memiliki izin untuk membuat gudang")
  }

  const name = formData.get("name") as string
  const location = formData.get("location") as string
  const type = formData.get("type") as string || "MAIN"
  const managerId = formData.get("managerId") as string
  const notes = formData.get("notes") as string

  if (!name) {
    throw new Error("Nama gudang wajib diisi")
  }

  await prisma.$transaction(async (tx) => {
    const code = await generateNextWarehouseCode(tx, organization.id)

    await tx.warehouse.create({
      data: {
        organizationId: organization.id,
        code,
        name,
        location,
        type,
        managerId,
        notes
      }
    })
  })

  revalidatePath("/warehouse")
  revalidatePath("/inventory")
  revalidatePath("/dashboard")
}

export async function updateWarehouse(formData: FormData) {
  const { user, organization } = await requireCurrentOrganization()

  if (!hasModulePermission(user, "warehouse")) {
    throw new Error("Anda tidak memiliki izin untuk mengedit gudang")
  }

  const id = formData.get("id") as string
  const name = formData.get("name") as string
  const location = formData.get("location") as string
  const type = formData.get("type") as string
  const managerId = formData.get("managerId") as string
  const status = formData.get("status") as string
  const notes = formData.get("notes") as string

  if (!id || !name) {
    throw new Error("Data tidak lengkap")
  }

  await prisma.warehouse.update({
    where: { id },
    data: {
      name,
      location,
      type,
      managerId,
      status,
      notes
    }
  })

  revalidatePath("/warehouse")
  revalidatePath("/inventory")
  revalidatePath("/dashboard")
}

export async function deleteWarehouse(id: string) {
  const { user } = await requireCurrentOrganization()

  if (!hasModulePermission(user, "warehouse")) {
    throw new Error("Anda tidak memiliki izin untuk menghapus gudang")
  }

  await prisma.warehouse.delete({
    where: { id }
  })

  revalidatePath("/warehouse")
  revalidatePath("/inventory")
  revalidatePath("/dashboard")
}
