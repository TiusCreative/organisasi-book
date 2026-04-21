"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "../../lib/prisma"
import {
  buildInvitePath,
  buildResetPasswordPath,
  clearSessionCookie,
  completeInvitePasswordSetup,
  completePasswordReset,
  createPasswordHash,
  createSessionToken,
  ensureBootstrapAdmin,
  getInviteUserByToken,
  getResetUserByToken,
  issueInviteToken,
  issueResetToken,
  requireModuleAccess,
  requireOrganizationAdmin,
  requirePlatformAdmin,
  setSessionCookie,
  verifyPassword,
} from "../../lib/auth"
import { UserRole } from "@prisma/client"
import { addOneYear, getRenewalBaseDate, isSubscriptionExpired } from "../../lib/subscription"
import { provisionOrganizationWithOwner } from "../../lib/organization-provisioning"
import { normalizeModulePermissions } from "../../lib/permissions"

export async function loginUser(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase()
  const password = String(formData.get("password") || "")

  if (!email || !password) {
    return { success: false, error: "Email dan password wajib diisi." }
  }

  await ensureBootstrapAdmin()

  const user = await prisma.user.findUnique({
    where: { email },
  })

  if (!user || user.status !== "ACTIVE") {
    return { success: false, error: "Email atau password salah." }
  }

  const validPassword = await verifyPassword(password, user.password)
  if (!validPassword) {
    return { success: false, error: "Email atau password salah." }
  }

  const token = await createSessionToken({ userId: user.id, role: user.role })
  await setSessionCookie(token)

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  })

  const organization = user.organizationId
    ? await prisma.organization.findUnique({
        where: { id: user.organizationId },
        select: { subscriptionEndsAt: true, status: true },
      })
    : null

  if (user.isPlatformAdmin && !user.organizationId) {
    return { success: true, redirectTo: "/platform-admin" }
  }

  const redirectTo =
    organization && organization.status === "ACTIVE" && isSubscriptionExpired(organization.subscriptionEndsAt)
      ? "/berlangganan"
      : "/"

  return { success: true, redirectTo }
}

export async function logoutUser() {
  await clearSessionCookie()
  return { success: true }
}

export async function registerOrganizationOwner(formData: FormData) {
  const ownerName = String(formData.get("ownerName") || "").trim()
  const organizationName = String(formData.get("organizationName") || "").trim()
  const email = String(formData.get("email") || "").trim().toLowerCase()
  const password = String(formData.get("password") || "")
  const type = String(formData.get("type") || "PERUSAHAAN").trim()
  const address = String(formData.get("address") || "").trim()
  const city = String(formData.get("city") || "").trim()
  const province = String(formData.get("province") || "").trim()
  const postalCode = String(formData.get("postalCode") || "").trim()
  const phone = String(formData.get("phone") || "").trim()
  const plan = String(formData.get("plan") || "ANNUAL").trim()

  if (!ownerName || !organizationName || !email || !password) {
    return { success: false, error: "Nama owner, nama organisasi, email, dan password wajib diisi." }
  }

  if (password.length < 8) {
    return { success: false, error: "Password minimal 8 karakter." }
  }

  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
    return { success: false, error: "Email sudah terdaftar." }
  }

  const { user } = await provisionOrganizationWithOwner({
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
    years: 1,
    subscriptionStatus: "ACTIVE",
  })

  const token = await createSessionToken({ userId: user.id, role: user.role })
  await setSessionCookie(token)

  revalidatePath("/")
  return { success: true, redirectTo: "/" }
}

export async function createAdminManagedUser(formData: FormData) {
  const admin = await requireOrganizationAdmin()
  const name = String(formData.get("name") || "").trim()
  const email = String(formData.get("email") || "").trim().toLowerCase()
  const password = String(formData.get("password") || "")
  const role = String(formData.get("role") || "STAFF") as UserRole
  const permissions = normalizeModulePermissions(formData.getAll("permissions").map(String))

  if (!name || !email || !password) {
    return { success: false, error: "Nama, email, dan password wajib diisi." }
  }

  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
    return { success: false, error: "Email user sudah digunakan." }
  }

  const orgUserCount = await prisma.user.count({
    where: { organizationId: admin.organizationId },
  })
  const organization = await prisma.organization.findUnique({
    where: { id: admin.organizationId || "" },
    select: { maxUsers: true },
  })

  if (organization && orgUserCount >= organization.maxUsers) {
    return { success: false, error: "Batas user untuk paket tahunan saat ini sudah tercapai." }
  }

  await prisma.user.create({
    data: {
      name,
      email,
      password: await createPasswordHash(password),
      role,
      permissions,
      status: "ACTIVE",
      passwordSetAt: new Date(),
      organizationId: admin.organizationId || null,
    },
  })

  revalidatePath("/admin/users")
  return { success: true }
}

export async function updateManagedUser(formData: FormData) {
  const admin = await requireOrganizationAdmin()
  const id = String(formData.get("id") || "")
  const name = String(formData.get("name") || "").trim()
  const email = String(formData.get("email") || "").trim().toLowerCase()
  const role = String(formData.get("role") || "STAFF") as UserRole
  const status = String(formData.get("status") || "ACTIVE")
  const password = String(formData.get("password") || "")
  const permissions = normalizeModulePermissions(formData.getAll("permissions").map(String))

  if (!id || !name || !email) {
    return { success: false, error: "Data user tidak lengkap." }
  }

  const existingUser = await prisma.user.findUnique({
    where: { id },
    select: { organizationId: true },
  })

  if (!existingUser || existingUser.organizationId !== admin.organizationId) {
    return { success: false, error: "User tidak ditemukan di organisasi Anda." }
  }

  const updateData: {
    name: string
    email: string
    role: UserRole
    permissions: string[]
    status: string
    organizationId: string | null
    password?: string
    passwordSetAt?: Date
  } = {
    name,
    email,
    role,
    permissions,
    status,
    organizationId: admin.organizationId || null,
  }

  if (password) {
    updateData.password = await createPasswordHash(password)
    updateData.passwordSetAt = new Date()
  }

  await prisma.user.update({
    where: { id },
    data: updateData,
  })

  revalidatePath("/admin/users")
  return { success: true }
}

export async function deleteManagedUser(userId: string) {
  const admin = await requireOrganizationAdmin()
  if (admin.id === userId) {
    return { success: false, error: "Admin yang sedang login tidak bisa menghapus dirinya sendiri." }
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  })

  if (!targetUser || targetUser.organizationId !== admin.organizationId) {
    return { success: false, error: "User tidak ditemukan di organisasi Anda." }
  }

  await prisma.user.delete({
    where: { id: userId },
  })

  revalidatePath("/admin/users")
  return { success: true }
}

export async function renewOrganizationSubscription() {
  const { organization } = await requireModuleAccess("subscription", { allowExpired: true })

  const baseDate = getRenewalBaseDate(organization.subscriptionEndsAt)
  const startsAt = organization.subscriptionStartsAt || new Date()
  const endsAt = addOneYear(baseDate)

  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      subscriptionPlan: "ANNUAL",
      subscriptionStatus: "ACTIVE",
      subscriptionStartsAt: startsAt,
      subscriptionEndsAt: endsAt,
      status: "ACTIVE",
    },
  })

  revalidatePath("/berlangganan")
  revalidatePath("/")
  return { success: true }
}

export async function getPlatformUsers() {
  await requirePlatformAdmin()
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      permissions: true,
      status: true,
      organizationId: true,
    },
  })
}

export async function generateManagedUserInvite(userId: string) {
  const admin = await requireOrganizationAdmin({ allowExpired: true })
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, organizationId: true },
  })

  if (!targetUser || targetUser.organizationId !== admin.organizationId) {
    return { success: false, error: "User tidak ditemukan di organisasi Anda." }
  }

  const invite = await issueInviteToken(userId)
  revalidatePath("/admin/users")
  return { success: true, path: invite.path }
}

export async function generateManagedUserReset(userId: string) {
  const admin = await requireOrganizationAdmin({ allowExpired: true })
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, organizationId: true },
  })

  if (!targetUser || targetUser.organizationId !== admin.organizationId) {
    return { success: false, error: "User tidak ditemukan di organisasi Anda." }
  }

  const reset = await issueResetToken(userId)
  revalidatePath("/admin/users")
  return { success: true, path: reset.path }
}

export async function generatePlatformOwnerInvite(organizationId: string) {
  await requirePlatformAdmin()
  const owner = await prisma.user.findFirst({
    where: {
      organizationId,
      role: "ADMIN",
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  })

  if (!owner) {
    return { success: false, error: "Owner organisasi tidak ditemukan." }
  }

  const invite = await issueInviteToken(owner.id)
  revalidatePath("/platform-admin")
  return { success: true, path: invite.path }
}

export async function generatePlatformOwnerReset(organizationId: string) {
  await requirePlatformAdmin()
  const owner = await prisma.user.findFirst({
    where: {
      organizationId,
      role: "ADMIN",
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  })

  if (!owner) {
    return { success: false, error: "Owner organisasi tidak ditemukan." }
  }

  const reset = await issueResetToken(owner.id)
  revalidatePath("/platform-admin")
  return { success: true, path: reset.path }
}

export async function completeInvitePasswordSetupAction(formData: FormData) {
  const token = String(formData.get("token") || "")
  const password = String(formData.get("password") || "")

  if (!token || !password) {
    return { success: false, error: "Token dan password wajib diisi." }
  }

  if (password.length < 8) {
    return { success: false, error: "Password minimal 8 karakter." }
  }

  const result = await completeInvitePasswordSetup(token, password)
  return result
}

export async function completePasswordResetAction(formData: FormData) {
  const token = String(formData.get("token") || "")
  const password = String(formData.get("password") || "")

  if (!token || !password) {
    return { success: false, error: "Token dan password wajib diisi." }
  }

  if (password.length < 8) {
    return { success: false, error: "Password minimal 8 karakter." }
  }

  const result = await completePasswordReset(token, password)
  return result
}

export async function validateInviteToken(token: string) {
  const user = await getInviteUserByToken(token)
  if (!user) {
    return null
  }

  return {
    token,
    name: user.name,
    email: user.email,
    path: buildInvitePath(token),
  }
}

export async function validateResetToken(token: string) {
  const user = await getResetUserByToken(token)
  if (!user) {
    return null
  }

  return {
    token,
    name: user.name,
    email: user.email,
    path: buildResetPasswordPath(token),
  }
}
