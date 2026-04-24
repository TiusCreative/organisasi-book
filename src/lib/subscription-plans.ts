export type SubscriptionPlanId = "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL" | "UNLIMITED"

export type SubscriptionPlanDefinition = {
  id: SubscriptionPlanId
  label: string
  durationMonths: number | null
  defaultAmountIdr: number | null
}

const ANNUAL_DEFAULT = Number(process.env.SUBSCRIPTION_ANNUAL_PRICE || "1200000")
const MONTHLY_DEFAULT = Math.round(ANNUAL_DEFAULT / 12)
const QUARTERLY_DEFAULT = Math.round(ANNUAL_DEFAULT / 4)
const SEMIANNUAL_DEFAULT = Math.round(ANNUAL_DEFAULT / 2)
const UNLIMITED_DEFAULT = process.env.SUBSCRIPTION_UNLIMITED_PRICE
  ? Number(process.env.SUBSCRIPTION_UNLIMITED_PRICE)
  : null

export const SUBSCRIPTION_PLANS: SubscriptionPlanDefinition[] = [
  { id: "MONTHLY", label: "1 Bulan", durationMonths: 1, defaultAmountIdr: MONTHLY_DEFAULT },
  { id: "QUARTERLY", label: "3 Bulan", durationMonths: 3, defaultAmountIdr: QUARTERLY_DEFAULT },
  { id: "SEMIANNUAL", label: "6 Bulan", durationMonths: 6, defaultAmountIdr: SEMIANNUAL_DEFAULT },
  { id: "ANNUAL", label: "1 Tahun", durationMonths: 12, defaultAmountIdr: ANNUAL_DEFAULT },
  { id: "UNLIMITED", label: "Unlimited", durationMonths: null, defaultAmountIdr: UNLIMITED_DEFAULT },
]

export function getSubscriptionPlan(planId: string): SubscriptionPlanDefinition | null {
  return SUBSCRIPTION_PLANS.find((plan) => plan.id === planId) || null
}

export function getSubscriptionPlanAmountIdr(planId: SubscriptionPlanId) {
  const plan = getSubscriptionPlan(planId)
  if (!plan) {
    throw new Error("Paket berlangganan tidak valid.")
  }

  if (plan.id === "UNLIMITED" && !plan.defaultAmountIdr) {
    throw new Error("Harga paket UNLIMITED belum diatur. Isi env SUBSCRIPTION_UNLIMITED_PRICE.")
  }

  if (!plan.defaultAmountIdr) {
    throw new Error("Harga paket berlangganan belum diatur.")
  }

  return plan.defaultAmountIdr
}

