import { prisma } from "./prisma"
import { addOneYear } from "./subscription"

type ProvisionOrganizationInput = {
  ownerName: string
  email: string
  passwordHash: string
  organizationName: string
  type: string
  address?: string
  city?: string
  province?: string
  postalCode?: string
  phone?: string
  plan?: string
  years?: number
  subscriptionStatus?: "ACTIVE" | "PENDING" | "SUSPENDED"
}

const defaultAccounts = [
  { code: "1001", name: "Kas Kecil", type: "Asset" },
  { code: "1002", name: "Rekening Bank", type: "Asset" },
  { code: "4001", name: "Pemasukan", type: "Revenue" },
  { code: "5001", name: "Biaya Operasional", type: "Expense" },
] as const

function buildSubscriptionEndDate(years: number, startDate: Date) {
  let endDate = new Date(startDate)
  for (let index = 0; index < years; index += 1) {
    endDate = addOneYear(endDate)
  }
  return endDate
}

export async function provisionOrganizationWithOwner(input: ProvisionOrganizationInput) {
  const now = new Date()
  const years = Math.max(1, input.years || 1)
  const normalizedEmail = input.email.trim().toLowerCase()
  const subscriptionStatus = input.subscriptionStatus || "ACTIVE"
  const subscriptionStartsAt = subscriptionStatus === "PENDING" ? null : now
  const subscriptionEndsAt = subscriptionStatus === "PENDING" ? null : buildSubscriptionEndDate(years, now)

  return prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: input.organizationName,
        type: input.type,
        address: input.address || null,
        city: input.city || null,
        province: input.province || null,
        postalCode: input.postalCode || null,
        phone: input.phone || null,
        email: normalizedEmail,
        currency: "IDR",
        fiscalYearStart: 1,
        subscriptionPlan: input.plan || "ANNUAL",
        subscriptionStatus,
        subscriptionStartsAt,
        subscriptionEndsAt,
        maxUsers: 5,
        status: "ACTIVE",
      },
    })

    for (const account of defaultAccounts) {
      await tx.chartOfAccount.create({
        data: {
          organizationId: organization.id,
          code: account.code,
          name: account.name,
          type: account.type,
        },
      })
    }

    const user = await tx.user.create({
      data: {
        name: input.ownerName,
        email: normalizedEmail,
        password: input.passwordHash,
        role: "ADMIN",
        permissions: [],
        status: "ACTIVE",
        passwordSetAt: new Date(),
        organizationId: organization.id,
      },
    })

    return { organization, user }
  })
}
