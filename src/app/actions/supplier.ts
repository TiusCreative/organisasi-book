"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requireCurrentOrganization } from "@/lib/auth"
import { hasModulePermission } from "@/lib/permissions"

async function generateNextSupplierCode(tx: any, orgId: string) {
  const existingSuppliers = await tx.supplier.findMany({
    where: { organizationId: orgId },
    select: { code: true },
    orderBy: { code: 'desc' },
    take: 1
  })

  if (existingSuppliers.length === 0) {
    return "SUPP-001"
  }

  const lastCode = existingSuppliers[0].code
  const lastNumber = parseInt(lastCode.split("-")[1])
  const nextNumber = lastNumber + 1
  return `SUPP-${String(nextNumber).padStart(3, '0')}`
}

export async function getSuppliers() {
  const { organization } = await requireCurrentOrganization()
  
  return await prisma.supplier.findMany({
    where: { organizationId: organization.id },
    orderBy: { createdAt: 'desc' }
  })
}

export async function createSupplier(formData: FormData) {
  const { user, organization } = await requireCurrentOrganization()

  if (!hasModulePermission(user, "supplier")) {
    throw new Error("Anda tidak memiliki izin untuk membuat supplier")
  }

  const name = formData.get("name") as string
  const contactPerson = formData.get("contactPerson") as string
  const email = formData.get("email") as string
  const phone = formData.get("phone") as string
  const mobile = formData.get("mobile") as string
  const address = formData.get("address") as string
  const city = formData.get("city") as string
  const province = formData.get("province") as string
  const postalCode = formData.get("postalCode") as string
  const country = formData.get("country") as string || "Indonesia"
  const npwp = formData.get("npwp") as string
  const bankAccount = formData.get("bankAccount") as string
  const bankName = formData.get("bankName") as string
  const paymentTerm = parseInt((formData.get("paymentTerm") as string) || "30")
  const notes = formData.get("notes") as string

  if (!name) {
    throw new Error("Nama supplier wajib diisi")
  }

  await prisma.$transaction(async (tx) => {
    const code = await generateNextSupplierCode(tx, organization.id)

    await tx.supplier.create({
      data: {
        organizationId: organization.id,
        code,
        name,
        contactPerson,
        email,
        phone,
        mobile,
        address,
        city,
        province,
        postalCode,
        country,
        npwp,
        bankAccount,
        bankName,
        paymentTerm,
        notes
      }
    })
  })

  revalidatePath("/supplier")
  revalidatePath("/dashboard")
}

export async function updateSupplier(formData: FormData) {
  const { user, organization } = await requireCurrentOrganization()

  if (!hasModulePermission(user, "supplier")) {
    throw new Error("Anda tidak memiliki izin untuk mengedit supplier")
  }

  const id = formData.get("id") as string
  const name = formData.get("name") as string
  const contactPerson = formData.get("contactPerson") as string
  const email = formData.get("email") as string
  const phone = formData.get("phone") as string
  const mobile = formData.get("mobile") as string
  const address = formData.get("address") as string
  const city = formData.get("city") as string
  const province = formData.get("province") as string
  const postalCode = formData.get("postalCode") as string
  const country = formData.get("country") as string || "Indonesia"
  const npwp = formData.get("npwp") as string
  const bankAccount = formData.get("bankAccount") as string
  const bankName = formData.get("bankName") as string
  const paymentTerm = parseInt((formData.get("paymentTerm") as string) || "30")
  const status = formData.get("status") as string
  const notes = formData.get("notes") as string

  if (!id || !name) {
    throw new Error("Data tidak lengkap")
  }

  await prisma.supplier.update({
    where: { id },
    data: {
      name,
      contactPerson,
      email,
      phone,
      mobile,
      address,
      city,
      province,
      postalCode,
      country,
      npwp,
      bankAccount,
      bankName,
      paymentTerm,
      status,
      notes
    }
  })

  revalidatePath("/supplier")
  revalidatePath("/dashboard")
}

export async function deleteSupplier(id: string) {
  const { user } = await requireCurrentOrganization()

  if (!hasModulePermission(user, "supplier")) {
    throw new Error("Anda tidak memiliki izin untuk menghapus supplier")
  }

  await prisma.supplier.delete({
    where: { id }
  })

  revalidatePath("/supplier")
  revalidatePath("/dashboard")
}
