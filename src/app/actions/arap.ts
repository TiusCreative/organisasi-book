"use server"

import { prisma } from "../../lib/prisma"
import { revalidatePath } from "next/cache"
import { requireCurrentOrganization } from "../../lib/auth"
import { hasModulePermission } from "../../lib/permissions"
import { logAudit } from "../../lib/audit-logger"

// ==================== CUSTOMER ====================

export async function createCustomer(formData: FormData) {
  const { user, organization } = await requireCurrentOrganization()

  if (!hasModulePermission(user, "accounts")) {
    throw new Error("Anda tidak memiliki izin untuk membuat customer.")
  }

  const name = formData.get("name") as string
  const email = formData.get("email") as string
  const phone = formData.get("phone") as string
  const address = formData.get("address") as string
  const city = formData.get("city") as string
  const npwp = formData.get("npwp") as string
  const creditLimit = parseFloat((formData.get("creditLimit") as string) || "0")
  const paymentTerm = parseInt((formData.get("paymentTerm") as string) || "30")
  const notes = formData.get("notes") as string

  // Generate customer code
  const lastCustomer = await prisma.customer.findFirst({
    where: { organizationId: organization.id },
    orderBy: { code: "desc" },
  })

  const lastCodeNum = lastCustomer ? parseInt(lastCustomer.code.split("-")[1]) : 0
  const code = `CUST-${String(lastCodeNum + 1).padStart(3, "0")}`

  const customer = await prisma.customer.create({
    data: {
      organizationId: organization.id,
      code,
      name,
      email,
      phone,
      address,
      city,
      npwp,
      creditLimit,
      paymentTerm,
      notes,
    },
  })

  await logAudit({
    organizationId: organization.id,
    action: "CREATE",
    entity: "Customer",
    entityId: customer.id,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    newData: customer,
  })

  revalidatePath("/arap")
  return { success: true, customer }
}

export async function updateCustomer(formData: FormData) {
  const { user } = await requireCurrentOrganization()

  if (!hasModulePermission(user, "accounts")) {
    throw new Error("Anda tidak memiliki izin untuk mengubah customer.")
  }

  const id = formData.get("id") as string
  const name = formData.get("name") as string
  const email = formData.get("email") as string
  const phone = formData.get("phone") as string
  const address = formData.get("address") as string
  const city = formData.get("city") as string
  const npwp = formData.get("npwp") as string
  const creditLimit = parseFloat((formData.get("creditLimit") as string) || "0")
  const paymentTerm = parseInt((formData.get("paymentTerm") as string) || "30")
  const status = formData.get("status") as string
  const notes = formData.get("notes") as string

  const oldCustomer = await prisma.customer.findUnique({ where: { id } })

  const customer = await prisma.customer.update({
    where: { id },
    data: {
      name,
      email,
      phone,
      address,
      city,
      npwp,
      creditLimit,
      paymentTerm,
      status,
      notes,
    },
  })

  await logAudit({
    organizationId: customer.organizationId,
    action: "UPDATE",
    entity: "Customer",
    entityId: id,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    oldData: oldCustomer,
    newData: customer,
  })

  revalidatePath("/arap")
  return { success: true, customer }
}

export async function deleteCustomer(id: string) {
  const { user } = await requireCurrentOrganization()

  if (user.role !== "ADMIN") {
    throw new Error("Hanya admin yang dapat menghapus customer.")
  }

  const customer = await prisma.customer.findUnique({ where: { id } })

  if (!customer) {
    throw new Error("Customer tidak ditemukan")
  }

  // Check if customer has invoices
  const invoiceCount = await prisma.invoice.count({ where: { customerId: id } })
  if (invoiceCount > 0) {
    throw new Error("Customer memiliki invoice aktif. Tidak dapat dihapus.")
  }

  await prisma.customer.delete({ where: { id } })

  await logAudit({
    organizationId: customer.organizationId,
    action: "DELETE",
    entity: "Customer",
    entityId: id,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    oldData: customer,
  })

  revalidatePath("/arap")
  return { success: true }
}

// ==================== SUPPLIER ====================

export async function createSupplier(formData: FormData) {
  const { user, organization } = await requireCurrentOrganization()

  if (!hasModulePermission(user, "accounts")) {
    throw new Error("Anda tidak memiliki izin untuk membuat supplier.")
  }

  const name = formData.get("name") as string
  const email = formData.get("email") as string
  const phone = formData.get("phone") as string
  const address = formData.get("address") as string
  const city = formData.get("city") as string
  const npwp = formData.get("npwp") as string
  const bankAccount = formData.get("bankAccount") as string
  const bankName = formData.get("bankName") as string
  const paymentTerm = parseInt((formData.get("paymentTerm") as string) || "30")
  const notes = formData.get("notes") as string

  // Generate supplier code
  const lastSupplier = await prisma.supplier.findFirst({
    where: { organizationId: organization.id },
    orderBy: { code: "desc" },
  })

  const lastCodeNum = lastSupplier ? parseInt(lastSupplier.code.split("-")[1]) : 0
  const code = `SUPP-${String(lastCodeNum + 1).padStart(3, "0")}`

  const supplier = await prisma.supplier.create({
    data: {
      organizationId: organization.id,
      code,
      name,
      email,
      phone,
      address,
      city,
      npwp,
      bankAccount,
      bankName,
      paymentTerm,
      notes,
    },
  })

  await logAudit({
    organizationId: organization.id,
    action: "CREATE",
    entity: "Supplier",
    entityId: supplier.id,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    newData: supplier,
  })

  revalidatePath("/arap")
  return { success: true, supplier }
}

export async function updateSupplier(formData: FormData) {
  const { user } = await requireCurrentOrganization()

  if (!hasModulePermission(user, "accounts")) {
    throw new Error("Anda tidak memiliki izin untuk mengubah supplier.")
  }

  const id = formData.get("id") as string
  const name = formData.get("name") as string
  const email = formData.get("email") as string
  const phone = formData.get("phone") as string
  const address = formData.get("address") as string
  const city = formData.get("city") as string
  const npwp = formData.get("npwp") as string
  const bankAccount = formData.get("bankAccount") as string
  const bankName = formData.get("bankName") as string
  const paymentTerm = parseInt((formData.get("paymentTerm") as string) || "30")
  const status = formData.get("status") as string
  const notes = formData.get("notes") as string

  const oldSupplier = await prisma.supplier.findUnique({ where: { id } })

  const supplier = await prisma.supplier.update({
    where: { id },
    data: {
      name,
      email,
      phone,
      address,
      city,
      npwp,
      bankAccount,
      bankName,
      paymentTerm,
      status,
      notes,
    },
  })

  await logAudit({
    organizationId: supplier.organizationId,
    action: "UPDATE",
    entity: "Supplier",
    entityId: id,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    oldData: oldSupplier,
    newData: supplier,
  })

  revalidatePath("/arap")
  return { success: true, supplier }
}

export async function deleteSupplier(id: string) {
  const { user } = await requireCurrentOrganization()

  if (user.role !== "ADMIN") {
    throw new Error("Hanya admin yang dapat menghapus supplier.")
  }

  const supplier = await prisma.supplier.findUnique({ where: { id } })

  if (!supplier) {
    throw new Error("Supplier tidak ditemukan")
  }

  // Check if supplier has vendor bills
  const billCount = await prisma.vendorBill.count({ where: { supplierId: id } })
  if (billCount > 0) {
    throw new Error("Supplier memiliki vendor bill aktif. Tidak dapat dihapus.")
  }

  await prisma.supplier.delete({ where: { id } })

  await logAudit({
    organizationId: supplier.organizationId,
    action: "DELETE",
    entity: "Supplier",
    entityId: id,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    oldData: supplier,
  })

  revalidatePath("/arap")
  return { success: true }
}

// ==================== GETTERS ====================

export async function getCustomers() {
  const { organization } = await requireCurrentOrganization()

  const customers = await prisma.customer.findMany({
    where: { organizationId: organization.id },
    orderBy: { name: "asc" },
  })

  return { success: true, customers }
}

export async function getSuppliers() {
  const { organization } = await requireCurrentOrganization()

  const suppliers = await prisma.supplier.findMany({
    where: { organizationId: organization.id },
    orderBy: { name: "asc" },
  })

  return { success: true, suppliers }
}
