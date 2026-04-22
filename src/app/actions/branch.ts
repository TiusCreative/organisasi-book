"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requireCurrentOrganization } from "@/lib/auth"
import { hasModulePermission } from "@/lib/permissions"

async function generateNextBranchCode(tx: any, orgId: string) {
  const existingBranches = await tx.branch.findMany({
    where: { organizationId: orgId },
    select: { code: true },
    orderBy: { code: 'desc' },
    take: 1
  })

  if (existingBranches.length === 0) {
    return "CAB-001"
  }

  const lastCode = existingBranches[0].code
  const lastNumber = parseInt(lastCode.split("-")[1])
  const nextNumber = lastNumber + 1
  return `CAB-${String(nextNumber).padStart(3, '0')}`
}

export async function getBranches() {
  const { organization } = await requireCurrentOrganization()
  
  return await prisma.branch.findMany({
    where: { organizationId: organization.id },
    include: {
      manager: {
        select: { id: true, name: true, email: true }
      },
      warehouse: {
        select: { id: true, name: true, code: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  })
}

export async function createBranch(formData: FormData) {
  const { user, organization } = await requireCurrentOrganization()

  if (!hasModulePermission(user, "branch")) {
    throw new Error("Anda tidak memiliki izin untuk membuat cabang")
  }

  const name = formData.get("name") as string
  const address = formData.get("address") as string
  const city = formData.get("city") as string
  const province = formData.get("province") as string
  const postalCode = formData.get("postalCode") as string
  const country = formData.get("country") as string || "Indonesia"
  const phone = formData.get("phone") as string
  const email = formData.get("email") as string
  const managerId = formData.get("managerId") as string
  const warehouseId = formData.get("warehouseId") as string
  const notes = formData.get("notes") as string

  if (!name) {
    throw new Error("Nama cabang wajib diisi")
  }

  await prisma.$transaction(async (tx) => {
    const code = await generateNextBranchCode(tx, organization.id)

    await tx.branch.create({
      data: {
        organizationId: organization.id,
        code,
        name,
        address,
        city,
        province,
        postalCode,
        country,
        phone,
        email,
        managerId,
        warehouseId,
        notes
      }
    })
  })

  revalidatePath("/branch")
  revalidatePath("/dashboard")
}

export async function updateBranch(formData: FormData) {
  const { user, organization } = await requireCurrentOrganization()

  if (!hasModulePermission(user, "branch")) {
    throw new Error("Anda tidak memiliki izin untuk mengedit cabang")
  }

  const id = formData.get("id") as string
  const name = formData.get("name") as string
  const address = formData.get("address") as string
  const city = formData.get("city") as string
  const province = formData.get("province") as string
  const postalCode = formData.get("postalCode") as string
  const country = formData.get("country") as string || "Indonesia"
  const phone = formData.get("phone") as string
  const email = formData.get("email") as string
  const managerId = formData.get("managerId") as string
  const warehouseId = formData.get("warehouseId") as string
  const status = formData.get("status") as string
  const notes = formData.get("notes") as string

  if (!id || !name) {
    throw new Error("Data tidak lengkap")
  }

  await prisma.branch.update({
    where: { id },
    data: {
      name,
      address,
      city,
      province,
      postalCode,
      country,
      phone,
      email,
      managerId,
      warehouseId,
      status,
      notes
    }
  })

  revalidatePath("/branch")
  revalidatePath("/dashboard")
}

export async function deleteBranch(id: string) {
  const { user } = await requireCurrentOrganization()

  if (!hasModulePermission(user, "branch")) {
    throw new Error("Anda tidak memiliki izin untuk menghapus cabang")
  }

  await prisma.branch.delete({
    where: { id }
  })

  revalidatePath("/branch")
  revalidatePath("/dashboard")
}
