import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { prisma } from "./prisma"
import { SESSION_COOKIE, createSessionToken, verifySessionToken } from "./session"
import { getSubscriptionState } from "./subscription"
import { hasModulePermission, type ModulePermission } from "./permissions"

const DEFAULT_ADMIN_NAME = process.env.ADMIN_NAME || "Administrator"
const DEFAULT_ADMIN_EMAIL = process.env.ADMIN_EMAIL?.trim().toLowerCase()
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
const PLATFORM_ADMIN_EMAILS = (process.env.PLATFORM_ADMIN_EMAILS || DEFAULT_ADMIN_EMAIL || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean)

function canBootstrapPlatformAdmin(email: string) {
  return PLATFORM_ADMIN_EMAILS.includes(email.trim().toLowerCase())
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

function createAccessTokenValue() {
  return `${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`
}

async function hashPassword(password: string) {
  const salt = crypto.randomUUID()
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${salt}:${password}`)
  )
  return `${salt}:${bytesToHex(new Uint8Array(hashBuffer))}`
}

export async function verifyPassword(password: string, storedPassword: string) {
  const [salt, hash] = storedPassword.split(":")
  if (!salt || !hash) {
    return false
  }

  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${salt}:${password}`)
  )

  return bytesToHex(new Uint8Array(hashBuffer)) === hash
}

export async function createPasswordHash(password: string) {
  return hashPassword(password)
}

export function buildInvitePath(token: string) {
  return `/invite/${token}`
}

export function buildResetPasswordPath(token: string) {
  return `/reset-password/${token}`
}

export async function issueInviteToken(userId: string) {
  const token = createAccessTokenValue()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      inviteToken: token,
      inviteTokenExpiresAt: expiresAt,
      resetToken: null,
      resetTokenExpiresAt: null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      inviteToken: true,
      inviteTokenExpiresAt: true,
    },
  })

  return {
    ...user,
    path: buildInvitePath(token),
  }
}

export async function issueResetToken(userId: string) {
  const token = createAccessTokenValue()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30)

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      resetToken: token,
      resetTokenExpiresAt: expiresAt,
    },
    select: {
      id: true,
      email: true,
      name: true,
      resetToken: true,
      resetTokenExpiresAt: true,
    },
  })

  return {
    ...user,
    path: buildResetPasswordPath(token),
  }
}

export async function getInviteUserByToken(token: string) {
  return prisma.user.findFirst({
    where: {
      inviteToken: token,
      inviteTokenExpiresAt: {
        gt: new Date(),
      },
    },
  })
}

export async function getResetUserByToken(token: string) {
  return prisma.user.findFirst({
    where: {
      resetToken: token,
      resetTokenExpiresAt: {
        gt: new Date(),
      },
    },
  })
}

export async function completeInvitePasswordSetup(token: string, password: string) {
  const user = await getInviteUserByToken(token)
  if (!user) {
    return { success: false, error: "Link undangan tidak valid atau sudah kedaluwarsa." }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await hashPassword(password),
      status: "ACTIVE",
      passwordSetAt: new Date(),
      inviteToken: null,
      inviteTokenExpiresAt: null,
    },
  })

  return { success: true }
}

export async function completePasswordReset(token: string, password: string) {
  const user = await getResetUserByToken(token)
  if (!user) {
    return { success: false, error: "Link reset password tidak valid atau sudah kedaluwarsa." }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await hashPassword(password),
      passwordSetAt: new Date(),
      resetToken: null,
      resetTokenExpiresAt: null,
      status: "ACTIVE",
    },
  })

  return { success: true }
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  })
}

export async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export async function getCurrentSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) {
    return null
  }

  return verifySessionToken(token)
}

export async function getCurrentUser() {
  const session = await getCurrentSession()
  if (!session) {
    return null
  }

  return prisma.user.findUnique({
    where: { id: session.userId },
  })
}

export async function requireUser() {
  const user = await getCurrentUser()
  if (!user || user.status !== "ACTIVE") {
    redirect("/login")
  }
  return user
}

export async function requireAdmin() {
  const user = await requireUser()
  if (user.role !== "ADMIN") {
    redirect("/")
  }
  return user
}

export async function requirePlatformAdmin() {
  const user = await requireUser()
  if (!user.isPlatformAdmin) {
    redirect("/")
  }
  return user
}

export async function requireOrganizationAdmin(options?: { allowExpired?: boolean }) {
  const { user } = await requireCurrentOrganization(options)
  if (user.role !== "ADMIN") {
    redirect("/")
  }
  return user
}

export async function requireModuleAccess(
  permission: ModulePermission,
  options?: { allowExpired?: boolean }
) {
  const context = await requireCurrentOrganization(options)
  if (!hasModulePermission(context.user, permission)) {
    redirect("/")
  }
  return context
}

export async function requireCurrentOrganization(options?: { allowExpired?: boolean }) {
  const user = await requireUser()

  if (!user.organizationId) {
    redirect(user.isPlatformAdmin ? "/platform-admin" : "/register")
  }

  const organization = await prisma.organization.findUnique({
    where: { id: user.organizationId },
  })

  if (!organization || organization.status !== "ACTIVE") {
    redirect("/register")
  }

  const subscriptionState = getSubscriptionState(organization.subscriptionEndsAt)
  const expired = subscriptionState.isExpired
  const suspended = organization.subscriptionStatus === "SUSPENDED"
  const blockedBySubscription = expired && !subscriptionState.isInGracePeriod
  if (!options?.allowExpired && (blockedBySubscription || suspended)) {
    redirect("/berlangganan")
  }

  return {
    user,
    organization,
    subscriptionExpired: expired,
    subscriptionSuspended: suspended,
    subscriptionInGracePeriod: subscriptionState.isInGracePeriod,
    subscriptionReminderActive: subscriptionState.isReminderWindow,
    subscriptionGraceEndsAt: subscriptionState.graceEndsAt,
    subscriptionExpiresInDays: subscriptionState.expiresInDays,
  }
}

export async function ensureBootstrapAdmin() {
  if (!DEFAULT_ADMIN_EMAIL || !DEFAULT_ADMIN_PASSWORD) {
    return
  }

  const shouldGrantPlatformAdmin = canBootstrapPlatformAdmin(DEFAULT_ADMIN_EMAIL)
  const existingAdmin = await prisma.user.findUnique({
    where: { email: DEFAULT_ADMIN_EMAIL.toLowerCase() },
    select: {
      id: true,
      isPlatformAdmin: true,
      status: true,
    },
  })

  if (existingAdmin) {
    if (
      existingAdmin.status !== "ACTIVE" ||
      (shouldGrantPlatformAdmin && !existingAdmin.isPlatformAdmin)
    ) {
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
          ...(shouldGrantPlatformAdmin ? { isPlatformAdmin: true } : {}),
          status: "ACTIVE",
        },
      })
    }
    return
  }

  const userCount = await prisma.user.count()
  if (userCount > 0) {
    return
  }

  const firstOrganization = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
  })

  await prisma.user.create({
    data: {
      name: DEFAULT_ADMIN_NAME,
      email: DEFAULT_ADMIN_EMAIL.toLowerCase(),
      password: await hashPassword(DEFAULT_ADMIN_PASSWORD),
      role: "ADMIN",
      permissions: [],
      isPlatformAdmin: shouldGrantPlatformAdmin,
      status: "ACTIVE",
      passwordSetAt: new Date(),
      organizationId: firstOrganization?.id || null,
    },
  })
}

export { SESSION_COOKIE, createSessionToken, verifySessionToken }
