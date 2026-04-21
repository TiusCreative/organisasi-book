"use server"

import { prisma } from "../../lib/prisma"
import { revalidatePath } from "next/cache"
import { requireCurrentOrganization, requireOrganizationAdmin } from "../../lib/auth"

// UPDATE ORGANIZATION DETAILS
export async function updateOrganization(formData: FormData) {
  const { organization } = await requireCurrentOrganization()
  const id = formData.get("id") as string
  const name = formData.get("name") as string
  const type = formData.get("type") as string
  const address = formData.get("address") as string
  const city = formData.get("city") as string
  const province = formData.get("province") as string
  const postalCode = formData.get("postalCode") as string
  const phone = formData.get("phone") as string
  const email = formData.get("email") as string
  const logo = formData.get("logo") as string
  const taxId = formData.get("taxId") as string
  const registrationNumber = formData.get("registrationNumber") as string
  const currency = formData.get("currency") as string
  const fiscalYearStart = parseInt(formData.get("fiscalYearStart") as string)

  if (!id || !name || !type) {
    throw new Error("Data organisasi tidak lengkap")
  }

  if (id !== organization.id) {
    throw new Error("Anda tidak bisa mengubah organisasi lain")
  }

  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      name,
      type,
      address: address || null,
      city: city || null,
      province: province || null,
      postalCode: postalCode || null,
      phone: phone || null,
      email: email || null,
      logo: logo || null,
      taxId: taxId || null,
      registrationNumber: registrationNumber || null,
      currency: currency || "IDR",
      fiscalYearStart: fiscalYearStart || 1
    }
  })

  revalidatePath("/pengaturan")
  return { success: true }
}

// CREATE NEW ORGANIZATION
export async function createOrganization(formData: FormData) {
  void formData
  throw new Error("Pembuatan organisasi mandiri hanya bisa dilakukan dari halaman register. Platform admin harus membuat owner dan organisasi sekaligus dari halaman Platform Admin.")
}

export async function deleteOrganization(organizationId: string) {
  const admin = await requireOrganizationAdmin({ allowExpired: true })

  if (!organizationId) {
    return { success: false, error: "Organisasi tidak valid." }
  }

  if (admin.organizationId !== organizationId) {
    return { success: false, error: "Anda tidak bisa menghapus organisasi lain." }
  }

  const existingOrganization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  })

  if (!existingOrganization) {
    return { success: false, error: "Organisasi tidak ditemukan." }
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.updateMany({
      where: { organizationId },
      data: { organizationId: null },
    })

    await tx.auditLog.deleteMany({
      where: { organizationId },
    })

    await tx.noteSequence.deleteMany({
      where: { organizationId },
    })

    await tx.taxEntry.deleteMany({
      where: { organizationId },
    })

    await tx.salarySlip.deleteMany({
      where: { organizationId },
    })

    await tx.employee.deleteMany({
      where: { organizationId },
    })

    await tx.investment.deleteMany({
      where: { organizationId },
    })

    await tx.bankAccount.deleteMany({
      where: { organizationId },
    })

    await tx.transaction.deleteMany({
      where: { organizationId },
    })

    await tx.chartOfAccount.deleteMany({
      where: { organizationId },
    })

    await tx.accountCategory.deleteMany({
      where: { organizationId },
    })

    await tx.organization.delete({
      where: { id: organizationId },
    })
  })

  revalidatePath("/")
  revalidatePath("/setup")
  revalidatePath("/pengaturan")
  revalidatePath("/transaksi")
  revalidatePath("/gaji")
  revalidatePath("/pajak")
  revalidatePath("/laporan")

  return { success: true }
}

// GET ORGANIZATION BY ID
export async function getOrganizationById(id: string) {
  return prisma.organization.findUnique({
    where: { id }
  })
}
