"use server"

import { prisma } from "@/lib/prisma"
import { requireModuleAccess } from "@/lib/auth"

type LedgerEntry = {
  id: string
  date: string
  accountCode: string
  accountName: string
  description: string
  debit: number
  credit: number
  balance: number
}

export type AccountLedger = {
  accountCode: string
  accountName: string
  accountType: string
  openingBalance: number
  entries: LedgerEntry[]
  closingBalance: number
  totalDebit: number
  totalCredit: number
}

function parseDate(value: unknown, fallback: Date) {
  if (typeof value !== "string" || !value.trim()) return fallback
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return fallback
  return parsed
}

function roundMoney(value: number) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
}

export async function getGeneralLedgerDetailedReport(input?: { startDate?: string; endDate?: string }) {
  const { organization } = await requireModuleAccess("reports")

  const now = new Date()
  const startDate = parseDate(input?.startDate, new Date(now.getFullYear(), 0, 1))
  const endDate = parseDate(input?.endDate, now)

  if (startDate > endDate) throw new Error("startDate tidak boleh lebih besar dari endDate")

  const [accounts, openingRows, lines] = await Promise.all([
    prisma.chartOfAccount.findMany({
      where: { organizationId: organization.id },
      select: { id: true, code: true, name: true, type: true },
      orderBy: [{ code: "asc" }],
      take: 20_000,
    }),
    prisma.$queryRawUnsafe<Array<{ accountId: string; opening: number }>>(
      `
        SELECT
          tl."accountId" as "accountId",
          COALESCE(SUM(tl."debit" - tl."credit"), 0)::double precision AS "opening"
        FROM "TransactionLine" tl
        JOIN "Transaction" t ON t."id" = tl."transactionId"
        WHERE t."organizationId" = $1
          AND t."date" < $2
        GROUP BY tl."accountId"
      `,
      organization.id,
      startDate,
    ),
    prisma.transactionLine.findMany({
      where: {
        transaction: {
          organizationId: organization.id,
          date: { gte: startDate, lte: endDate },
        },
      },
      include: {
        transaction: {
          select: { date: true, description: true, reference: true, createdAt: true },
        },
        account: {
          select: { id: true, code: true, name: true, type: true },
        },
      },
      orderBy: [
        { account: { code: "asc" } },
        { transaction: { date: "asc" } },
        { transaction: { createdAt: "asc" } },
      ],
      take: 200_000,
    }),
  ])

  const openingById = new Map(openingRows.map((r) => [r.accountId, roundMoney(Number(r.opening || 0))]))
  const accountById = new Map(accounts.map((acc) => [acc.id, acc]))

  const entriesByAccount = new Map<
    string,
    Array<Omit<LedgerEntry, "balance"> & { delta: number }>
  >()

  for (const line of lines) {
    const accountId = line.accountId
    const account = accountById.get(accountId) || line.account
    if (!account) continue

    const tx = line.transaction
    const description = [tx.reference, line.description || tx.description].filter(Boolean).join(" - ")
    const debit = roundMoney(Number(line.debit || 0))
    const credit = roundMoney(Number(line.credit || 0))
    const delta = roundMoney(debit - credit)

    const entries = entriesByAccount.get(accountId) || []
    entries.push({
      id: line.id,
      date: tx.date.toISOString(),
      accountCode: account.code,
      accountName: account.name,
      description,
      debit,
      credit,
      delta,
    })
    entriesByAccount.set(accountId, entries)
  }

  const result: AccountLedger[] = []

  for (const account of accounts) {
    const openingBalance = openingById.get(account.id) ?? 0
    const rawEntries = entriesByAccount.get(account.id) || []

    if (rawEntries.length === 0 && Math.abs(openingBalance) < 0.000001) continue

    let runningBalance = openingBalance
    const entries: LedgerEntry[] = rawEntries.map((entry) => {
      runningBalance = roundMoney(runningBalance + entry.delta)
      return {
        id: entry.id,
        date: entry.date,
        accountCode: entry.accountCode,
        accountName: entry.accountName,
        description: entry.description,
        debit: entry.debit,
        credit: entry.credit,
        balance: runningBalance,
      }
    })

    const totalDebit = roundMoney(entries.reduce((sum, e) => sum + e.debit, 0))
    const totalCredit = roundMoney(entries.reduce((sum, e) => sum + e.credit, 0))
    const closingBalance = roundMoney(openingBalance + totalDebit - totalCredit)

    result.push({
      accountCode: account.code,
      accountName: account.name,
      accountType: account.type,
      openingBalance,
      entries,
      closingBalance,
      totalDebit,
      totalCredit,
    })
  }

  return {
    organizationId: organization.id,
    organizationName: organization.name,
    period: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
    accounts: result,
  }
}

