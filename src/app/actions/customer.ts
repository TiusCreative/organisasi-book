"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requireCurrentOrganization } from "@/lib/auth"
import { hasModulePermission } from "@/lib/permissions"

async function generateNextCustomerCode(tx: any, orgId: string) {
  const existingCustomers = await tx.customer.findMany({
    where: { organizationId: orgId },
    select: { code: true },
    orderBy: { code: 'desc' },
    take: 1
  })

  if (existingCustomers.length === 0) {
    return "CUST-001"
  }

  const lastCode = existingCustomers[0].code
  const lastNumber = parseInt(lastCode.split("-")[1])
  const nextNumber = lastNumber + 1
  return `CUST-${String(nextNumber).padStart(3, '0')}`
}

export async function getCustomers() {
  const { organization } = await requireCurrentOrganization()
  
  return await prisma.customer.findMany({
    where: { organizationId: organization.id },
    orderBy: { createdAt: 'desc' }
  })
}

export async function createCustomer(formData: FormData) {
  const { user, organization } = await requireCurrentOrganization()

  if (!hasModulePermission(user, "customer")) {
    throw new Error("Anda tidak memiliki izin untuk membuat customer")
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
  const creditLimit = parseFloat((formData.get("creditLimit") as string) || "0")
  const paymentTerm = parseInt((formData.get("paymentTerm") as string) || "30")
  const notes = formData.get("notes") as string

  if (!name) {
    throw new Error("Nama customer wajib diisi")
  }

  await prisma.$transaction(async (tx) => {
    const code = await generateNextCustomerCode(tx, organization.id)

    await tx.customer.create({
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
        creditLimit,
        paymentTerm,
        notes
      }
    })
  })

  revalidatePath("/customer")
  revalidatePath("/dashboard")
}

export async function updateCustomer(formData: FormData) {
  const { user, organization } = await requireCurrentOrganization()

  if (!hasModulePermission(user, "customer")) {
    throw new Error("Anda tidak memiliki izin untuk mengedit customer")
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
  const creditLimit = parseFloat((formData.get("creditLimit") as string) || "0")
  const paymentTerm = parseInt((formData.get("paymentTerm") as string) || "30")
  const status = formData.get("status") as string
  const notes = formData.get("notes") as string

  if (!id || !name) {
    throw new Error("Data tidak lengkap")
  }

  await prisma.customer.update({
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
      creditLimit,
      paymentTerm,
      status,
      notes
    }
  })

  revalidatePath("/customer")
  revalidatePath("/dashboard")
}

export async function deleteCustomer(id: string) {
  const { user } = await requireCurrentOrganization()

  if (!hasModulePermission(user, "customer")) {
    throw new Error("Anda tidak memiliki izin untuk menghapus customer")
  }

  await prisma.customer.delete({
    where: { id }
  })

  revalidatePath("/customer")
  revalidatePath("/dashboard")
}
