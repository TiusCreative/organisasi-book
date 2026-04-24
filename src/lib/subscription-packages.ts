import { prisma } from "./prisma"

export type SubscriptionPackageSummary = {
  id: string
  code: string
  name: string
  durationMonths: number | null
  amountIdr: number | null
  isActive: boolean
}

const ANNUAL_DEFAULT = Number(process.env.SUBSCRIPTION_ANNUAL_PRICE || "1200000")
const MONTHLY_DEFAULT = Math.round(ANNUAL_DEFAULT / 12)
const QUARTERLY_DEFAULT = Math.round(ANNUAL_DEFAULT / 4)
const SEMIANNUAL_DEFAULT = Math.round(ANNUAL_DEFAULT / 2)
const UNLIMITED_DEFAULT = process.env.SUBSCRIPTION_UNLIMITED_PRICE ? Number(process.env.SUBSCRIPTION_UNLIMITED_PRICE) : null

export const DEFAULT_SUBSCRIPTION_PACKAGES: Array<
  Pick<SubscriptionPackageSummary, "code" | "name" | "durationMonths" | "amountIdr" | "isActive">
> = [
  { code: "MONTHLY", name: "1 Bulan", durationMonths: 1, amountIdr: MONTHLY_DEFAULT, isActive: true },
  { code: "QUARTERLY", name: "3 Bulan", durationMonths: 3, amountIdr: QUARTERLY_DEFAULT, isActive: true },
  { code: "SEMIANNUAL", name: "6 Bulan", durationMonths: 6, amountIdr: SEMIANNUAL_DEFAULT, isActive: true },
  { code: "ANNUAL", name: "1 Tahun", durationMonths: 12, amountIdr: ANNUAL_DEFAULT, isActive: true },
  { code: "UNLIMITED", name: "Unlimited", durationMonths: null, amountIdr: UNLIMITED_DEFAULT, isActive: true },
]

export async function listSubscriptionPackages(options?: { activeOnly?: boolean }) {
  const rows = await prisma.subscriptionPackage.findMany({
    where: options?.activeOnly ? { isActive: true } : undefined,
    orderBy: [{ durationMonths: "asc" }, { createdAt: "asc" }],
  })

  return rows.map<SubscriptionPackageSummary>((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    durationMonths: row.durationMonths,
    amountIdr: row.amountIdr,
    isActive: row.isActive,
  }))
}

export async function getSubscriptionPackageByCode(code: string) {
  const normalized = String(code || "").trim()
  if (!normalized) return null

  const row = await prisma.subscriptionPackage.findUnique({
    where: { code: normalized },
  })

  if (!row) return null

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    durationMonths: row.durationMonths,
    amountIdr: row.amountIdr,
    isActive: row.isActive,
  } satisfies SubscriptionPackageSummary
}

export async function ensureDefaultSubscriptionPackages() {
  const delegate = (prisma as unknown as Record<string, unknown>).subscriptionPackage
  if (!delegate) {
    throw new Error(
      "Prisma Client belum ter-generate untuk model SubscriptionPackage. Jalankan `npx prisma generate` lalu restart dev server."
    )
  }

  let existingCount = 0
  try {
    existingCount = await prisma.subscriptionPackage.count()
  } catch (error) {
    throw new Error(
      "Tabel SubscriptionPackage belum ada di database. Jalankan `npx prisma db push` (atau jalankan migration) lalu restart dev server."
    )
  }
  if (existingCount > 0) return

  await prisma.subscriptionPackage.createMany({
    data: DEFAULT_SUBSCRIPTION_PACKAGES.map((pkg) => ({
      code: pkg.code,
      name: pkg.name,
      durationMonths: pkg.durationMonths,
      amountIdr: pkg.amountIdr,
      isActive: pkg.isActive,
    })),
    skipDuplicates: true,
  })
}

export function requirePackageAmountIdr(pkg: Pick<SubscriptionPackageSummary, "code" | "amountIdr">) {
  if (pkg.code === "UNLIMITED" && !pkg.amountIdr) {
    throw new Error("Harga paket UNLIMITED belum diatur.")
  }

  if (!pkg.amountIdr) {
    throw new Error("Harga paket berlangganan belum diatur.")
  }

  return pkg.amountIdr
}
