const ONE_YEAR_IN_MONTHS = 12
const DEFAULT_REMINDER_DAYS = Number(process.env.SUBSCRIPTION_REMINDER_DAYS || "14")
const DEFAULT_GRACE_DAYS = Number(process.env.SUBSCRIPTION_GRACE_DAYS || "7")

export function addOneYear(referenceDate = new Date()) {
  const next = new Date(referenceDate)
  next.setMonth(next.getMonth() + ONE_YEAR_IN_MONTHS)
  return next
}

export function isSubscriptionExpired(endDate?: Date | null) {
  if (!endDate) {
    return false
  }

  return new Date(endDate).getTime() < Date.now()
}

export function addDays(referenceDate: Date, days: number) {
  const next = new Date(referenceDate)
  next.setDate(next.getDate() + days)
  return next
}

export function getSubscriptionReminderDays() {
  return DEFAULT_REMINDER_DAYS
}

export function getSubscriptionGraceDays() {
  return DEFAULT_GRACE_DAYS
}

export function getSubscriptionState(endDate?: Date | null) {
  if (!endDate) {
    return {
      isExpired: false,
      isInGracePeriod: false,
      isReminderWindow: false,
      expiresInDays: null as number | null,
      graceEndsAt: null as Date | null,
    }
  }

  const normalizedEndDate = new Date(endDate)
  const now = Date.now()
  const expiresInDays = Math.ceil((normalizedEndDate.getTime() - now) / (1000 * 60 * 60 * 24))
  const isExpired = normalizedEndDate.getTime() < now
  const graceEndsAt = addDays(normalizedEndDate, getSubscriptionGraceDays())
  const isInGracePeriod = isExpired && graceEndsAt.getTime() >= now
  const isReminderWindow = !isExpired && expiresInDays <= getSubscriptionReminderDays()

  return {
    isExpired,
    isInGracePeriod,
    isReminderWindow,
    expiresInDays,
    graceEndsAt,
  }
}

export function getRenewalBaseDate(endDate?: Date | null) {
  if (!endDate) {
    return new Date()
  }

  return isSubscriptionExpired(endDate) ? new Date() : new Date(endDate)
}

export function formatSubscriptionPeriod(startDate?: Date | null, endDate?: Date | null) {
  const start = startDate ? new Date(startDate).toLocaleDateString("id-ID") : "-"
  const end = endDate ? new Date(endDate).toLocaleDateString("id-ID") : "-"
  return `${start} s.d. ${end}`
}
