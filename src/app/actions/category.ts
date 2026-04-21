"use server"

import { prisma } from "../../lib/prisma"
import { revalidatePath } from "next/cache"
import { requireCurrentOrganization } from "../../lib/auth"
import { hasModulePermission } from "../../lib/permissions"

// FUNGSI UNTUK MENAMBAH KATEGORI AKUN
export async function createAccountCategory(formData: FormData) {
  const { user, organization } = await requireCurrentOrganization()

  // Permission check: hanya ADMIN, MANAGER yang bisa membuat kategori
  if (!hasModulePermission(user, "accounts")) {
    throw new Error("Anda tidak memiliki izin untuk membuat kategori akun.")
  }

  const orgId = organization.id
  const name = formData.get("name") as string
  const color = formData.get("color") as string

  if (!name || !color) {
    throw new Error("Data kategori tidak lengkap")
  }

  await prisma.accountCategory.create({
    data: {
      organizationId: orgId,
      name,
      color
    }
  })

  revalidatePath("/akun")
}

// FUNGSI UNTUK EDIT KATEGORI AKUN
export async function updateAccountCategory(formData: FormData) {
  const { user } = await requireCurrentOrganization()

  // Permission check: hanya ADMIN, MANAGER yang bisa edit kategori
  if (!hasModulePermission(user, "accounts")) {
    throw new Error("Anda tidak memiliki izin untuk mengubah kategori akun.")
  }

  const id = formData.get("id") as string
  const name = formData.get("name") as string
  const color = formData.get("color") as string

  if (!id || !name || !color) {
    throw new Error("Data kategori tidak lengkap")
  }

  await prisma.accountCategory.update({
    where: { id },
    data: { name, color }
  })

  revalidatePath("/akun")
}

// FUNGSI UNTUK HAPUS KATEGORI AKUN
export async function deleteAccountCategory(id: string) {
  try {
    const { user } = await requireCurrentOrganization()

    // Permission check: hanya ADMIN yang bisa hapus kategori
    if (user.role !== "ADMIN") {
      throw new Error("Anda tidak memiliki izin untuk menghapus kategori akun. Hanya admin yang dapat menghapus.")
    }

    // First, unlink all accounts from this category
    await prisma.chartOfAccount.updateMany({
      where: { categoryId: id },
      data: { categoryId: null }
    })

    // Then delete the category
    await prisma.accountCategory.delete({
      where: { id }
    })

    revalidatePath("/akun")
    return { success: true }
  } catch (error) {
    console.error("Error deleting category:", error)
    throw new Error("Gagal menghapus kategori")
  }
}

// FUNGSI UNTUK MENGAITKAN KATEGORI KE AKUN
export async function linkCategoryToAccount(accountId: string, categoryId: string | null) {
  const { user } = await requireCurrentOrganization()

  // Permission check: hanya ADMIN, MANAGER yang bisa mengaitkan kategori
  if (!hasModulePermission(user, "accounts")) {
    throw new Error("Anda tidak memiliki izin untuk mengaitkan kategori ke akun.")
  }

  await prisma.chartOfAccount.update({
    where: { id: accountId },
    data: { categoryId }
  })

  revalidatePath("/akun")
}
