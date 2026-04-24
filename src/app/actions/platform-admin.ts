"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { prisma } from "../../lib/prisma"
import { createPasswordHash, requirePlatformAdmin } from "../../lib/auth"
import { logAudit } from "../../lib/audit-logger"
import { provisionOrganizationWithOwner } from "../../lib/organization-provisioning"
import { getSubscriptionPackageByCode } from "@/lib/subscription-packages"
import { addMonths } from "@/lib/subscription"
import { getMidtransTransactionStatus, mapMidtransTransactionStatus, isMidtransConfigured } from "@/lib/midtrans"
import { applySubscriptionPaymentStatusUpdate } from "@/lib/subscription-payment"

export async function createPlatformClientTenant(formData: FormData) {
  const admin = await requirePlatformAdmin()

  const ownerName = String(formData.get("ownerName") || "").trim()
  const organizationName = String(formData.get("organizationName") || "").trim()
  const email = String(formData.get("email") || "").trim().toLowerCase()
  const password = String(formData.get("password") || "")
  const type = String(formData.get("type") || "PERUSAHAAN").trim()
  const plan = String(formData.get("plan") || "ANNUAL").trim() || "ANNUAL"
  const address = String(formData.get("address") || "").trim()
  const city = String(formData.get("city") || "").trim()
  const province = String(formData.get("province") || "").trim()
  const postalCode = String(formData.get("postalCode") || "").trim()
  const phone = String(formData.get("phone") || "").trim()
  const years = Math.max(1, Number(formData.get("years") || "1"))
  const subscriptionStatus = String(formData.get("subscriptionStatus") || "ACTIVE").trim()

  if (!ownerName || !organizationName || !email || !password) {
    return { success: false, error: "Nama owner, nama organisasi, email, dan password wajib diisi." }
  }

  if (password.length < 8) {
    return { success: false, error: "Password minimal 8 karakter." }
  }

  if (!["ACTIVE", "PENDING", "SUSPENDED"].includes(subscriptionStatus)) {
    return { success: false, error: "Status subscription awal tidak valid." }
  }

  const pkg = await getSubscriptionPackageByCode(plan)
  if (!pkg || !pkg.isActive) {
    return { success: false, error: "Paket subscription tidak valid." }
  }

  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
    return { success: false, error: "Email sudah dipakai user lain." }
  }

  const { organization, user } = await provisionOrganizationWithOwner({
    ownerName,
    email,
    passwordHash: await createPasswordHash(password),
    organizationName,
    type,
    address,
    city,
    province,
    postalCode,
    phone,
    plan,
    years,
    subscriptionStatus: subscriptionStatus as "ACTIVE" | "PENDING" | "SUSPENDED",
  })

  await logAudit({
    organizationId: organization.id,
    action: "CREATE",
    entity: "Organization",
    entityId: organization.id,
    userId: admin.id,
    userName: admin.name,
    userEmail: admin.email,
    newData: {
      organizationName: organization.name,
      ownerName: user.name,
      ownerEmail: user.email,
      subscriptionStatus: organization.subscriptionStatus,
      subscriptionEndsAt: organization.subscriptionEndsAt,
    },
    reason: "Platform admin membuat owner dan organisasi client baru",
  })

  revalidatePath("/platform-admin")
  return { success: true, organizationId: organization.id }
}

export async function extendPlatformOrganizationSubscription(formData: FormData) {
  const admin = await requirePlatformAdmin()

  const organizationId = String(formData.get("organizationId") || "")
  const planId = String(formData.get("plan") || "ANNUAL").trim() || "ANNUAL"
  const quantity = Math.max(1, Number(formData.get("quantity") || "1"))

  if (!organizationId) {
    return { success: false, error: "ID organisasi tidak lengkap." }
  }

  const pkg = await getSubscriptionPackageByCode(planId)
  if (!pkg || !pkg.isActive) {
    return { success: false, error: "Paket subscription tidak valid." }
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      subscriptionStartsAt: true,
      subscriptionEndsAt: true,
      subscriptionStatus: true,
      subscriptionPlan: true,
    },
  })

  if (!organization) {
    return { success: false, error: "Organisasi tidak ditemukan." }
  }

  const baseDate =
    organization.subscriptionEndsAt && new Date(organization.subscriptionEndsAt).getTime() > Date.now()
      ? new Date(organization.subscriptionEndsAt)
      : new Date()

  const nextEndDate =
    pkg.durationMonths === null ? null : addMonths(baseDate, (pkg.durationMonths || 12) * quantity)

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      subscriptionPlan: pkg.code,
      subscriptionStatus: "ACTIVE",
      subscriptionStartsAt: organization.subscriptionStartsAt || new Date(),
      subscriptionEndsAt: nextEndDate,
      status: "ACTIVE",
    },
  })

  await logAudit({
    organizationId,
    action: "UPDATE",
    entity: "OrganizationSubscription",
    entityId: organizationId,
    userId: admin.id,
    userName: admin.name,
    userEmail: admin.email,
    oldData: {
      subscriptionPlan: organization.subscriptionPlan,
      subscriptionStatus: organization.subscriptionStatus,
      subscriptionEndsAt: organization.subscriptionEndsAt,
    },
    newData: {
      subscriptionPlan: pkg.code,
      subscriptionStatus: "ACTIVE",
      subscriptionEndsAt: nextEndDate,
    },
    reason: `Platform admin memperpanjang subscription (${pkg.code} x${quantity})`,
  })

  revalidatePath("/platform-admin")
  return { success: true }
}

export async function setPlatformOrganizationSubscriptionStatus(formData: FormData) {
  const admin = await requirePlatformAdmin()

  const organizationId = String(formData.get("organizationId") || "")
  const action = String(formData.get("action") || "")

  if (!organizationId || !action) {
    return { success: false, error: "Data organisasi atau aksi tidak lengkap." }
  }

  if (action === "activate") {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, subscriptionEndsAt: true, subscriptionStartsAt: true, subscriptionStatus: true },
    })

    if (!organization) {
      return { success: false, error: "Organisasi tidak ditemukan." }
    }

    const now = new Date()
    const nextEndDate =
      organization.subscriptionEndsAt && new Date(organization.subscriptionEndsAt).getTime() > Date.now()
        ? organization.subscriptionEndsAt
        : new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())

    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        subscriptionStatus: "ACTIVE",
        subscriptionStartsAt: organization.subscriptionStartsAt || now,
        subscriptionEndsAt: nextEndDate,
        status: "ACTIVE",
      },
    })

    await logAudit({
      organizationId,
      action: "UPDATE",
      entity: "OrganizationSubscription",
      entityId: organizationId,
      userId: admin.id,
      userName: admin.name,
      userEmail: admin.email,
      oldData: {
        subscriptionStatus: organization.subscriptionStatus,
        subscriptionEndsAt: organization.subscriptionEndsAt,
      },
      newData: {
        subscriptionStatus: "ACTIVE",
        subscriptionEndsAt: nextEndDate,
      },
      reason: "Platform admin mengaktifkan subscription manual",
    })
  }

  if (action === "suspend") {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, subscriptionStatus: true, subscriptionEndsAt: true },
    })

    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        subscriptionStatus: "SUSPENDED",
        status: "ACTIVE",
      },
    })

    await logAudit({
      organizationId,
      action: "UPDATE",
      entity: "OrganizationSubscription",
      entityId: organizationId,
      userId: admin.id,
      userName: admin.name,
      userEmail: admin.email,
      oldData: {
        subscriptionStatus: organization?.subscriptionStatus,
        subscriptionEndsAt: organization?.subscriptionEndsAt,
      },
      newData: {
        subscriptionStatus: "SUSPENDED",
      },
      reason: "Platform admin menonaktifkan subscription manual",
    })
  }

  revalidatePath("/platform-admin")
  return { success: true }
}

export async function updatePlatformOrganizationExpiry(formData: FormData) {
  const admin = await requirePlatformAdmin()

  const organizationId = String(formData.get("organizationId") || "")
  const expiryDate = String(formData.get("expiryDate") || "")

  if (!organizationId || !expiryDate) {
    return { success: false, error: "ID organisasi dan expiry date wajib diisi." }
  }

  const parsedDate = new Date(`${expiryDate}T23:59:59.999Z`)
  if (Number.isNaN(parsedDate.getTime())) {
    return { success: false, error: "Format expiry date tidak valid." }
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { subscriptionStartsAt: true, subscriptionEndsAt: true, subscriptionStatus: true },
  })

  if (!organization) {
    return { success: false, error: "Organisasi tidak ditemukan." }
  }

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      subscriptionStatus: parsedDate.getTime() > Date.now() ? "ACTIVE" : "EXPIRED",
      subscriptionStartsAt: organization.subscriptionStartsAt || new Date(),
      subscriptionEndsAt: parsedDate,
      status: "ACTIVE",
    },
  })

  await logAudit({
    organizationId,
    action: "UPDATE",
    entity: "OrganizationSubscription",
    entityId: organizationId,
    userId: admin.id,
    userName: admin.name,
    userEmail: admin.email,
    oldData: {
      subscriptionEndsAt: organization.subscriptionEndsAt,
      subscriptionStatus: organization.subscriptionStatus,
    },
    newData: {
      subscriptionEndsAt: parsedDate,
      subscriptionStatus: parsedDate.getTime() > Date.now() ? "ACTIVE" : "EXPIRED",
    },
    reason: "Platform admin mengubah expiry date subscription",
  })

  revalidatePath("/platform-admin")
  return { success: true }
}

export async function deletePlatformOrganization(formData: FormData) {
  const admin = await requirePlatformAdmin()
  const organizationId = String(formData.get("organizationId") || "")
  const confirmName = String(formData.get("confirmName") || "").trim()

  if (!organizationId || !confirmName) {
    return { success: false, error: "Data tidak lengkap." }
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  })

  if (!organization) {
    return { success: false, error: "Organisasi tidak ditemukan." }
  }

  if (organization.name.toLowerCase() !== confirmName.toLowerCase()) {
    return { success: false, error: "Nama organisasi tidak cocok." }
  }

  const isSkippableSchemaError = (error: unknown) =>
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")

  try {
    // Run deletes sequentially by dependency order.
    // Each query is isolated so a skippable schema error doesn't poison subsequent queries.
    const deleteOps: Array<{ name: string; run: () => Promise<unknown> }> = [
      { name: "transactionAttachment", run: () => prisma.transactionAttachment.deleteMany({ where: { transaction: { organizationId } } }) },
      { name: "transactionLine", run: () => prisma.transactionLine.deleteMany({ where: { transaction: { organizationId } } }) },
      { name: "taxEntry", run: () => prisma.taxEntry.deleteMany({ where: { organizationId } }) },
      { name: "allowance", run: () => prisma.allowance.deleteMany({ where: { employee: { organizationId } } }) },
      { name: "deduction", run: () => prisma.deduction.deleteMany({ where: { employee: { organizationId } } }) },
      { name: "salarySlip", run: () => prisma.salarySlip.deleteMany({ where: { organizationId } }) },
      { name: "budgetActual", run: () => prisma.budgetActual.deleteMany({ where: { budget: { organizationId } } }) },
      { name: "budgetItem", run: () => prisma.budgetItem.deleteMany({ where: { budget: { organizationId } } }) },
      { name: "recurringTransactionLine", run: () => prisma.recurringTransactionLine.deleteMany({ where: { recurringTransaction: { organizationId } } }) },
      { name: "deliveryOrderItem", run: () => prisma.deliveryOrderItem.deleteMany({ where: { deliveryOrder: { organizationId } } }) },
      { name: "salesCommission", run: () => prisma.salesCommission.deleteMany({ where: { organizationId } }) },
      { name: "deliveryOrder", run: () => prisma.deliveryOrder.deleteMany({ where: { organizationId } }) },
      { name: "salesOrderItem", run: () => prisma.salesOrderItem.deleteMany({ where: { salesOrder: { organizationId } } }) },
      { name: "salesOrder", run: () => prisma.salesOrder.deleteMany({ where: { organizationId } }) },
      { name: "stockOpnameItem", run: () => prisma.stockOpnameItem.deleteMany({ where: { stockOpname: { organizationId } } }) },
      { name: "stockOpname", run: () => prisma.stockOpname.deleteMany({ where: { organizationId } }) },
      { name: "inventoryMovement", run: () => prisma.inventoryMovement.deleteMany({ where: { organizationId } }) },
      { name: "inventoryItem", run: () => prisma.inventoryItem.deleteMany({ where: { organizationId } }) },
      { name: "workOrderItem", run: () => prisma.workOrderItem.deleteMany({ where: { workOrder: { organizationId } } }) },
      { name: "workOrder", run: () => prisma.workOrder.deleteMany({ where: { organizationId } }) },
      { name: "pettyCashTransaction", run: () => prisma.pettyCashTransaction.deleteMany({ where: { pettyCash: { organizationId } } }) },
      { name: "pettyCash", run: () => prisma.pettyCash.deleteMany({ where: { organizationId } }) },
      { name: "bankReconciliationItem", run: () => prisma.bankReconciliationItem.deleteMany({ where: { reconciliation: { organizationId } } }) },
      { name: "bankReconciliation", run: () => prisma.bankReconciliation.deleteMany({ where: { organizationId } }) },
      { name: "purchaseOrderItem", run: () => prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { organizationId } } }) },
      { name: "purchaseOrder", run: () => prisma.purchaseOrder.deleteMany({ where: { organizationId } }) },
      { name: "invoicePayment", run: () => prisma.invoicePayment.deleteMany({ where: { organizationId } }) },
      { name: "invoiceItem", run: () => prisma.invoiceItem.deleteMany({ where: { invoice: { organizationId } } }) },
      { name: "invoice", run: () => prisma.invoice.deleteMany({ where: { organizationId } }) },
      { name: "vendorBillPayment", run: () => prisma.vendorBillPayment.deleteMany({ where: { organizationId } }) },
      { name: "vendorBillItem", run: () => prisma.vendorBillItem.deleteMany({ where: { vendorBill: { organizationId } } }) },
      { name: "vendorBill", run: () => prisma.vendorBill.deleteMany({ where: { organizationId } }) },
      { name: "customer", run: () => prisma.customer.deleteMany({ where: { organizationId } }) },
      { name: "supplier", run: () => prisma.supplier.deleteMany({ where: { organizationId } }) },
      { name: "exchangeRate", run: () => prisma.exchangeRate.deleteMany({ where: { organizationId } }) },
      { name: "currency", run: () => prisma.currency.deleteMany({ where: { organizationId } }) },
      { name: "budget", run: () => prisma.budget.deleteMany({ where: { organizationId } }) },
      { name: "branch", run: () => prisma.branch.deleteMany({ where: { organizationId } }) },
      { name: "warehouse", run: () => prisma.warehouse.deleteMany({ where: { organizationId } }) },
      { name: "division-parent-nullify", run: () => prisma.division.updateMany({ where: { organizationId }, data: { parentId: null } }) },
      { name: "division", run: () => prisma.division.deleteMany({ where: { organizationId } }) },
      { name: "investment", run: () => prisma.investment.deleteMany({ where: { organizationId } }) },
      { name: "transaction", run: () => prisma.transaction.deleteMany({ where: { organizationId } }) },
      { name: "recurringTransaction", run: () => prisma.recurringTransaction.deleteMany({ where: { organizationId } }) },
      { name: "employee", run: () => prisma.employee.deleteMany({ where: { organizationId } }) },
      { name: "subscriptionPayment", run: () => prisma.subscriptionPayment.deleteMany({ where: { organizationId } }) },
      { name: "periodLock", run: () => prisma.periodLock.deleteMany({ where: { organizationId } }) },
      { name: "noteSequence", run: () => prisma.noteSequence.deleteMany({ where: { organizationId } }) },
      { name: "auditLog", run: () => prisma.auditLog.deleteMany({ where: { organizationId } }) },
      { name: "user", run: () => prisma.user.deleteMany({ where: { organizationId } }) },
      { name: "bankAccount", run: () => prisma.bankAccount.deleteMany({ where: { organizationId } }) },
      { name: "chartOfAccount", run: () => prisma.chartOfAccount.deleteMany({ where: { organizationId } }) },
      { name: "accountCategory", run: () => prisma.accountCategory.deleteMany({ where: { organizationId } }) },
      { name: "organization", run: () => prisma.organization.delete({ where: { id: organizationId } }) },
    ]

    for (const op of deleteOps) {
      try {
        await op.run()
      } catch (error) {
        if (isSkippableSchemaError(error)) {
          console.warn(`[platform-admin] Skip ${op.name} delete due to schema mismatch`, error)
          continue
        }
        throw error
      }
    }
  } catch (error) {
    console.error("[platform-admin] Failed to delete organization", { organizationId, error })
    return { success: false, error: "Gagal menghapus organisasi. Cek data relasi organisasi dan coba lagi." }
  }

  await logAudit({
    organizationId: null,
    action: "DELETE",
    entity: "Organization",
    entityId: organizationId,
    userId: admin.id,
    userName: admin.name,
    userEmail: admin.email,
    oldData: { organizationName: organization.name, deletedOrganizationId: organizationId },
    reason: "Platform admin menghapus organisasi",
  })

  revalidatePath("/platform-admin")
  return { success: true }
}

export async function resetPlatformOwnerPassword(formData: FormData) {
  const admin = await requirePlatformAdmin()
  const organizationId = String(formData.get("organizationId") || "")
  const newPassword = String(formData.get("newPassword") || "")

  if (!organizationId || !newPassword) {
    return { success: false, error: "Data tidak lengkap." }
  }

  if (newPassword.length < 8) {
    return { success: false, error: "Password minimal 8 karakter." }
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      users: {
        where: { role: "ADMIN" },
        select: { id: true, name: true, email: true },
      },
    },
  })

  if (!organization || !organization.users[0]) {
    return { success: false, error: "Owner tidak ditemukan." }
  }

  await prisma.user.update({
    where: { id: organization.users[0].id },
    data: {
      password: await createPasswordHash(newPassword),
      passwordSetAt: new Date(),
      status: "ACTIVE",
    },
  })

  await logAudit({
    organizationId,
    action: "UPDATE",
    entity: "User",
    entityId: organization.users[0].id,
    userId: admin.id,
    userName: admin.name,
    userEmail: admin.email,
    newData: { ownerName: organization.users[0].name, ownerEmail: organization.users[0].email },
    reason: "Platform admin mereset password owner",
  })

  revalidatePath("/platform-admin")
  return { success: true }
}

export async function updatePlatformOwnerEmail(formData: FormData) {
  const admin = await requirePlatformAdmin()
  const organizationId = String(formData.get("organizationId") || "")
  const newEmail = String(formData.get("newEmail") || "").trim().toLowerCase()

  if (!organizationId || !newEmail) {
    return { success: false, error: "Data tidak lengkap." }
  }

  const existingUser = await prisma.user.findUnique({ where: { email: newEmail } })
  if (existingUser) {
    return { success: false, error: "Email sudah digunakan." }
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      users: {
        where: { role: "ADMIN" },
        select: { id: true, name: true, email: true },
      },
    },
  })

  if (!organization || !organization.users[0]) {
    return { success: false, error: "Owner tidak ditemukan." }
  }

  await prisma.user.update({
    where: { id: organization.users[0].id },
    data: { email: newEmail },
  })

  await logAudit({
    organizationId,
    action: "UPDATE",
    entity: "User",
    entityId: organization.users[0].id,
    userId: admin.id,
    userName: admin.name,
    userEmail: admin.email,
    oldData: { oldEmail: organization.users[0].email },
    newData: { newEmail },
    reason: "Platform admin mengubah email owner",
  })

  revalidatePath("/platform-admin")
  return { success: true }
}

export async function createSubscriptionPackage(formData: FormData) {
  await requirePlatformAdmin()

  const code = String(formData.get("code") || "").trim().toUpperCase()
  const name = String(formData.get("name") || "").trim()
  const durationRaw = String(formData.get("durationMonths") || "").trim()
  const amountRaw = String(formData.get("amountIdr") || "").trim()
  const isActive = String(formData.get("isActive") || "on") === "on"

  if (!code || !name) {
    return { success: false, error: "Kode dan nama paket wajib diisi." }
  }

  const durationMonths = durationRaw ? Math.max(1, Number(durationRaw)) : null
  const amountIdr = amountRaw ? Math.max(0, Number(amountRaw)) : null

  try {
    await prisma.subscriptionPackage.create({
      data: {
        code,
        name,
        durationMonths: durationMonths && Number.isFinite(durationMonths) ? Math.trunc(durationMonths) : null,
        amountIdr: amountIdr && Number.isFinite(amountIdr) ? Math.trunc(amountIdr) : null,
        isActive,
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, error: "Kode paket sudah ada." }
    }
    return { success: false, error: error instanceof Error ? error.message : "Gagal membuat paket." }
  }

  revalidatePath("/platform-admin")
  return { success: true }
}

export async function updateSubscriptionPackage(formData: FormData) {
  await requirePlatformAdmin()

  const id = String(formData.get("id") || "").trim()
  const name = String(formData.get("name") || "").trim()
  const durationRaw = String(formData.get("durationMonths") || "").trim()
  const amountRaw = String(formData.get("amountIdr") || "").trim()
  const isActive = String(formData.get("isActive") || "off") === "on"

  if (!id || !name) {
    return { success: false, error: "Data paket tidak lengkap." }
  }

  const durationMonths = durationRaw ? Math.max(1, Number(durationRaw)) : null
  const amountIdr = amountRaw ? Math.max(0, Number(amountRaw)) : null

  await prisma.subscriptionPackage.update({
    where: { id },
    data: {
      name,
      durationMonths: durationMonths && Number.isFinite(durationMonths) ? Math.trunc(durationMonths) : null,
      amountIdr: amountIdr && Number.isFinite(amountIdr) ? Math.trunc(amountIdr) : null,
      isActive,
    },
  })

  revalidatePath("/platform-admin")
  return { success: true }
}

export async function deleteSubscriptionPackage(formData: FormData) {
  await requirePlatformAdmin()

  const id = String(formData.get("id") || "").trim()
  if (!id) {
    return { success: false, error: "ID paket tidak lengkap." }
  }

  await prisma.subscriptionPackage.delete({ where: { id } })
  revalidatePath("/platform-admin")
  return { success: true }
}

export async function syncMidtransPaymentStatus(formData: FormData) {
  await requirePlatformAdmin()

  if (!isMidtransConfigured()) {
    return { success: false, error: "Midtrans belum dikonfigurasi." }
  }

  const orderId = String(formData.get("orderId") || "").trim()
  if (!orderId) return { success: false, error: "Order ID tidak valid." }

  const payment = await prisma.subscriptionPayment.findUnique({
    where: { orderId },
    select: { orderId: true, provider: true },
  })

  if (!payment) return { success: false, error: "Payment tidak ditemukan." }
  if (payment.provider !== "MIDTRANS") return { success: false, error: "Sync hanya untuk MIDTRANS." }

  const statusPayload = await getMidtransTransactionStatus(orderId)
  const transactionStatus = String(statusPayload.transaction_status || "")
  const mappedStatus = mapMidtransTransactionStatus(
    transactionStatus,
    statusPayload.fraud_status ? String(statusPayload.fraud_status) : null
  )

  await applySubscriptionPaymentStatusUpdate({
    orderId,
    mappedStatus,
    paymentType: statusPayload.payment_type ? String(statusPayload.payment_type) : null,
    transactionId: statusPayload.transaction_id ? String(statusPayload.transaction_id) : null,
    payload: statusPayload,
  })

  revalidatePath("/platform-admin")
  return { success: true, status: mappedStatus }
}

export async function updateSubscriptionPaymentAdmin(formData: FormData) {
  const admin = await requirePlatformAdmin()

  const id = String(formData.get("id") || "").trim()
  const status = String(formData.get("status") || "").trim()
  const plan = String(formData.get("plan") || "").trim()
  const years = Math.max(1, Number(formData.get("years") || "1"))
  const amount = Math.max(0, Number(formData.get("amount") || "0"))
  const paidAtRaw = String(formData.get("paidAt") || "").trim()

  if (!id || !status) {
    return { success: false, error: "Data payment tidak lengkap." }
  }

  const existing = await prisma.subscriptionPayment.findUnique({ where: { id } })
  if (!existing) return { success: false, error: "Payment tidak ditemukan." }

  const paidAt = paidAtRaw ? new Date(paidAtRaw) : existing.paidAt
  if (paidAt && Number.isNaN(paidAt.getTime())) {
    return { success: false, error: "Tanggal paidAt tidak valid." }
  }

  await prisma.subscriptionPayment.update({
    where: { id },
    data: {
      status,
      plan: plan || existing.plan,
      years,
      amount: Number.isFinite(amount) ? amount : existing.amount,
      paidAt,
    },
  })

  await logAudit({
    organizationId: existing.organizationId,
    action: "UPDATE",
    entity: "SubscriptionPayment",
    entityId: existing.id,
    userId: admin.id,
    userName: admin.name,
    userEmail: admin.email,
    oldData: {
      status: existing.status,
      plan: existing.plan,
      years: existing.years,
      amount: existing.amount,
      paidAt: existing.paidAt,
    },
    newData: {
      status,
      plan: plan || existing.plan,
      years,
      amount: Number.isFinite(amount) ? amount : existing.amount,
      paidAt,
    },
    reason: "Platform admin mengubah payment subscription",
  })

  revalidatePath("/platform-admin")
  return { success: true }
}

export async function deleteSubscriptionPaymentAdmin(formData: FormData) {
  const admin = await requirePlatformAdmin()

  const id = String(formData.get("id") || "").trim()
  if (!id) return { success: false, error: "ID payment tidak valid." }

  const existing = await prisma.subscriptionPayment.findUnique({ where: { id } })
  if (!existing) return { success: false, error: "Payment tidak ditemukan." }

  await prisma.subscriptionPayment.delete({ where: { id } })

  await logAudit({
    organizationId: existing.organizationId,
    action: "DELETE",
    entity: "SubscriptionPayment",
    entityId: existing.id,
    userId: admin.id,
    userName: admin.name,
    userEmail: admin.email,
    oldData: {
      orderId: existing.orderId,
      provider: existing.provider,
      status: existing.status,
      plan: existing.plan,
      amount: existing.amount,
      paidAt: existing.paidAt,
    },
    reason: "Platform admin menghapus payment subscription",
  })

  revalidatePath("/platform-admin")
  return { success: true }
}
