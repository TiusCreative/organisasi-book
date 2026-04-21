"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "../../lib/prisma"
import { createPasswordHash, requirePlatformAdmin } from "../../lib/auth"
import { logAudit } from "../../lib/audit-logger"
import { provisionOrganizationWithOwner } from "../../lib/organization-provisioning"

export async function createPlatformClientTenant(formData: FormData) {
  const admin = await requirePlatformAdmin()

  const ownerName = String(formData.get("ownerName") || "").trim()
  const organizationName = String(formData.get("organizationName") || "").trim()
  const email = String(formData.get("email") || "").trim().toLowerCase()
  const password = String(formData.get("password") || "")
  const type = String(formData.get("type") || "PERUSAHAAN").trim()
  const plan = String(formData.get("plan") || "ANNUAL").trim()
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
