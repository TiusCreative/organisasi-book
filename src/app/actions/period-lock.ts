"use server"

import { revalidatePath } from "next/cache"
import { requireCurrentOrganization } from "../../lib/auth"
import { lockPeriod, unlockPeriod, getPeriodLocks, getLockedPeriods } from "../../lib/period-lock"
import { logAudit } from "../../lib/audit-logger"

/**
 * Lock period - hanya admin yang bisa lock
 */
export async function lockPeriodAction(formData: FormData) {
  const { user, organization } = await requireCurrentOrganization()

  if (user.role !== "ADMIN") {
    return { success: false, error: "Hanya admin yang bisa mengunci period." }
  }

  const year = parseInt(formData.get("year") as string)
  const monthValue = formData.get("month") as string
  const month = monthValue ? parseInt(monthValue) : undefined
  const lockType = (formData.get("lockType") as string) || "PERIOD"
  const reason = formData.get("reason") as string

  if (!year || isNaN(year)) {
    return { success: false, error: "Tahun tidak valid" }
  }

  if (lockType === "PERIOD" && !month) {
    return { success: false, error: "Bulan wajib diisi untuk lock per period" }
  }

  try {
    await lockPeriod({
      organizationId: organization.id,
      year,
      month: month || undefined,
      lockType: lockType as "PERIOD" | "YEAR" | "FULL",
      lockedBy: user.id,
      lockedByName: user.name,
      reason,
    })

    await logAudit({
      organizationId: organization.id,
      action: "CREATE",
      entity: "PeriodLock",
      entityId: `${year}-${month || 'FULL'}`,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      newData: { year, month, lockType, reason },
    })

    revalidatePath("/pengaturan")
    return { success: true }
  } catch (error) {
    console.error("Lock period error:", error)
    return { success: false, error: "Gagal mengunci period" }
  }
}

/**
 * Unlock period - hanya admin yang bisa unlock
 */
export async function unlockPeriodAction(formData: FormData) {
  const { user, organization } = await requireCurrentOrganization()

  if (user.role !== "ADMIN") {
    return { success: false, error: "Hanya admin yang bisa membuka period." }
  }

  const year = parseInt(formData.get("year") as string)
  const monthValue = formData.get("month") as string
  const month = monthValue ? parseInt(monthValue) : null
  const unlockReason = formData.get("unlockReason") as string

  if (!year || isNaN(year)) {
    return { success: false, error: "Tahun tidak valid" }
  }

  try {
    await unlockPeriod(
      organization.id,
      year,
      month,
      user.id,
      user.name,
      unlockReason
    )

    await logAudit({
      organizationId: organization.id,
      action: "UPDATE",
      entity: "PeriodLock",
      entityId: `${year}-${month || 'FULL'}`,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      newData: { year, month, unlocked: true, reason: unlockReason },
    })

    revalidatePath("/pengaturan")
    return { success: true }
  } catch (error) {
    console.error("Unlock period error:", error)
    return { success: false, error: error instanceof Error ? error.message : "Gagal membuka period" }
  }
}

/**
 * Get all period locks
 */
export async function getPeriodLocksAction() {
  const { user, organization } = await requireCurrentOrganization()

  if (user.role !== "ADMIN") {
    return { success: false, error: "Hanya admin yang bisa melihat period locks." }
  }

  const locks = await getPeriodLocks(organization.id)
  return { success: true, locks }
}

/**
 * Get only locked periods
 */
export async function getLockedPeriodsAction() {
  const { user, organization } = await requireCurrentOrganization()

  const locks = await getLockedPeriods(organization.id)
  return { success: true, locks }
}
