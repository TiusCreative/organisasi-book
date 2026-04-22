"use server"

import { prisma } from "@/lib/prisma"
import { requireCurrentOrganization } from "@/lib/auth"
import { revalidatePath } from "next/cache"

export async function getCurrencies(organizationId: string) {
  const { organization } = await requireCurrentOrganization()
  if (!organization || organization.id !== organizationId) {
    throw new Error("Unauthorized")
  }

  const currencies = await prisma.currency.findMany({
    where: { organizationId },
    orderBy: { isBase: 'desc' }
  })

  return currencies
}

export async function createCurrency(data: {
  organizationId: string
  code: string
  name: string
  symbol: string
  isBase?: boolean
}) {
  const { organization } = await requireCurrentOrganization()
  if (!organization || organization.id !== data.organizationId) {
    throw new Error("Unauthorized")
  }

  // If setting as base currency, unset other base currencies
  if (data.isBase) {
    await prisma.currency.updateMany({
      where: { organizationId: data.organizationId },
      data: { isBase: false }
    })
  }

  const currency = await prisma.currency.create({
    data: {
      organizationId: data.organizationId,
      code: data.code,
      name: data.name,
      symbol: data.symbol,
      isBase: data.isBase || false
    }
  })

  revalidatePath("/pengaturan")
  return currency
}

export async function getExchangeRates(organizationId: string) {
  const { organization } = await requireCurrentOrganization()
  if (!organization || organization.id !== organizationId) {
    throw new Error("Unauthorized")
  }

  const rates = await prisma.exchangeRate.findMany({
    where: { organizationId },
    include: {
      fromCurrency: true,
      toCurrency: true
    },
    orderBy: { effectiveDate: 'desc' }
  })

  return rates
}

export async function createExchangeRate(data: {
  organizationId: string
  fromCurrencyId: string
  toCurrencyId: string
  rate: number
  effectiveDate: Date
}) {
  const { organization } = await requireCurrentOrganization()
  if (!organization || organization.id !== data.organizationId) {
    throw new Error("Unauthorized")
  }

  const exchangeRate = await prisma.exchangeRate.create({
    data: {
      organizationId: data.organizationId,
      fromCurrencyId: data.fromCurrencyId,
      toCurrencyId: data.toCurrencyId,
      rate: data.rate,
      effectiveDate: data.effectiveDate
    }
  })

  revalidatePath("/pengaturan")
  return exchangeRate
}
