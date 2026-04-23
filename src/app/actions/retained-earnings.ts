"use server"

import { prisma } from "@/lib/prisma"
import { requireModuleAccess } from "@/lib/auth"

function parseDate(value: unknown, fallback: Date) {
  if (typeof value !== "string" || !value.trim()) return fallback
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return fallback
  return d
}

function roundMoney(value: number) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
}

async function getNetIncome(organizationId: string, startDate: Date, endDate: Date) {
  const rows = await prisma.$queryRawUnsafe<Array<{ netIncome: number }>>(
    `
      SELECT
        COALESCE(SUM(
          CASE
            WHEN a."type" = 'Revenue' THEN (tl."credit" - tl."debit")
            WHEN a."type" = 'Expense' THEN -(tl."debit" - tl."credit")
            ELSE 0
          END
        ), 0)::double precision AS "netIncome"
      FROM "TransactionLine" tl
      JOIN "Transaction" t ON t."id" = tl."transactionId"
      JOIN "ChartOfAccount" a ON a."id" = tl."accountId"
      WHERE t."organizationId" = $1
        AND t."date" >= $2 AND t."date" <= $3
    `,
    organizationId,
    startDate,
    endDate,
  )

  return roundMoney(Number(rows[0]?.netIncome || 0))
}

export async function getRetainedEarningsReport(input?: { startDate?: string; endDate?: string }) {
  const { organization } = await requireModuleAccess("reports")

  const now = new Date()
  const startDate = parseDate(input?.startDate, new Date(now.getFullYear(), 0, 1))
  const endDate = parseDate(input?.endDate, now)

  if (startDate > endDate) throw new Error("startDate tidak boleh lebih besar dari endDate")

  const [retainedAccounts, dividendAccounts, openingRows, periodRows, netIncome] = await Promise.all([
    prisma.chartOfAccount.findMany({
      where: { organizationId: organization.id, type: "Equity", category: { is: { name: "Laba Ditahan" } } },
      select: { id: true, code: true, name: true, category: { select: { name: true } } },
      orderBy: [{ code: "asc" }],
    }),
    prisma.chartOfAccount.findMany({
      where: { organizationId: organization.id, type: "Equity", category: { is: { name: "Dividen" } } },
      select: { id: true, code: true, name: true, category: { select: { name: true } } },
      orderBy: [{ code: "asc" }],
    }),
    prisma.$queryRawUnsafe<Array<{ accountId: string; opening: number }>>(
      `
        SELECT
          tl."accountId" as "accountId",
          COALESCE(SUM(tl."credit" - tl."debit"), 0)::double precision AS "opening"
        FROM "TransactionLine" tl
        JOIN "Transaction" t ON t."id" = tl."transactionId"
        JOIN "ChartOfAccount" a ON a."id" = tl."accountId"
        LEFT JOIN "AccountCategory" c ON c."id" = a."categoryId"
        WHERE t."organizationId" = $1
          AND a."type" = 'Equity'
          AND c."name" IN ('Laba Ditahan', 'Dividen')
          AND t."date" < $2
        GROUP BY tl."accountId"
      `,
      organization.id,
      startDate,
    ),
    prisma.$queryRawUnsafe<Array<{ accountId: string; debit: number; credit: number }>>(
      `
        SELECT
          tl."accountId" as "accountId",
          COALESCE(SUM(tl."debit"), 0)::double precision AS "debit",
          COALESCE(SUM(tl."credit"), 0)::double precision AS "credit"
        FROM "TransactionLine" tl
        JOIN "Transaction" t ON t."id" = tl."transactionId"
        JOIN "ChartOfAccount" a ON a."id" = tl."accountId"
        LEFT JOIN "AccountCategory" c ON c."id" = a."categoryId"
        WHERE t."organizationId" = $1
          AND a."type" = 'Equity'
          AND c."name" IN ('Laba Ditahan', 'Dividen')
          AND t."date" >= $2 AND t."date" <= $3
        GROUP BY tl."accountId"
      `,
      organization.id,
      startDate,
      endDate,
    ),
    getNetIncome(organization.id, startDate, endDate),
  ])

  const openingById = new Map(openingRows.map((r) => [r.accountId, roundMoney(Number(r.opening || 0))]))
  const periodById = new Map(periodRows.map((r) => [r.accountId, { debit: roundMoney(Number(r.debit || 0)), credit: roundMoney(Number(r.credit || 0)) }]))

  const buildRows = (accounts: Array<{ id: string; code: string; name: string; category?: { name: string } | null }>) =>
    accounts.map((acc) => {
      const opening = openingById.get(acc.id) ?? 0
      const period = periodById.get(acc.id) ?? { debit: 0, credit: 0 }
      const netChange = roundMoney(period.credit - period.debit)
      const closing = roundMoney(opening + netChange)
      return {
        accountId: acc.id,
        code: acc.code,
        name: acc.name,
        category: acc.category?.name ?? null,
        opening,
        debit: period.debit,
        credit: period.credit,
        netChange,
        closing,
      }
    })

  const retained = buildRows(retainedAccounts)
  const dividends = buildRows(dividendAccounts)

  const retainedTotals = retained.reduce((sum, r) => sum + r.closing, 0)
  const dividendTotals = dividends.reduce((sum, r) => sum + r.netChange, 0)

  return {
    organizationId: organization.id,
    organizationName: organization.name,
    period: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
    netIncome,
    retainedEarnings: { rows: retained, totalClosing: roundMoney(retainedTotals) },
    dividends: { rows: dividends, totalNetChange: roundMoney(dividendTotals) },
    note:
      "Jika perusahaan belum melakukan jurnal penutupan, laba periode berjalan biasanya masih berada di akun pendapatan/biaya (bukan otomatis masuk ke Laba Ditahan).",
  }
}

export async function getReservesAndDistributionsReport(input?: { startDate?: string; endDate?: string }) {
  const { organization } = await requireModuleAccess("reports")

  const now = new Date()
  const startDate = parseDate(input?.startDate, new Date(now.getFullYear(), 0, 1))
  const endDate = parseDate(input?.endDate, now)

  if (startDate > endDate) throw new Error("startDate tidak boleh lebih besar dari endDate")

  const excludedCategories = new Set(["Modal", "Laba Ditahan"])

  const accounts = await prisma.chartOfAccount.findMany({
    where: { organizationId: organization.id, type: "Equity" },
    select: { id: true, code: true, name: true, category: { select: { name: true } } },
    orderBy: [{ code: "asc" }],
  })

  const targetAccounts = accounts.filter((a) => !excludedCategories.has(a.category?.name || "")).map((a) => a.id)

  const [openingRows, periodRows] = targetAccounts.length
    ? await Promise.all([
        prisma.$queryRawUnsafe<Array<{ accountId: string; opening: number }>>(
          `
            SELECT
              tl."accountId" as "accountId",
              COALESCE(SUM(tl."credit" - tl."debit"), 0)::double precision AS "opening"
            FROM "TransactionLine" tl
            JOIN "Transaction" t ON t."id" = tl."transactionId"
            WHERE t."organizationId" = $1
              AND t."date" < $2
              AND tl."accountId" = ANY($3::text[])
            GROUP BY tl."accountId"
          `,
          organization.id,
          startDate,
          targetAccounts,
        ),
        prisma.$queryRawUnsafe<Array<{ accountId: string; debit: number; credit: number }>>(
          `
            SELECT
              tl."accountId" as "accountId",
              COALESCE(SUM(tl."debit"), 0)::double precision AS "debit",
              COALESCE(SUM(tl."credit"), 0)::double precision AS "credit"
            FROM "TransactionLine" tl
            JOIN "Transaction" t ON t."id" = tl."transactionId"
            WHERE t."organizationId" = $1
              AND t."date" >= $2 AND t."date" <= $3
              AND tl."accountId" = ANY($4::text[])
            GROUP BY tl."accountId"
          `,
          organization.id,
          startDate,
          endDate,
          targetAccounts,
        ),
      ])
    : [[], []]

  const openingById = new Map(openingRows.map((r) => [r.accountId, roundMoney(Number(r.opening || 0))]))
  const periodById = new Map(periodRows.map((r) => [r.accountId, { debit: roundMoney(Number(r.debit || 0)), credit: roundMoney(Number(r.credit || 0)) }]))

  const rows = accounts
    .filter((a) => !excludedCategories.has(a.category?.name || ""))
    .map((acc) => {
      const opening = openingById.get(acc.id) ?? 0
      const period = periodById.get(acc.id) ?? { debit: 0, credit: 0 }
      const netChange = roundMoney(period.credit - period.debit)
      const closing = roundMoney(opening + netChange)
      return {
        accountId: acc.id,
        code: acc.code,
        name: acc.name,
        category: acc.category?.name ?? null,
        opening,
        debit: period.debit,
        credit: period.credit,
        netChange,
        closing,
      }
    })

  return {
    organizationId: organization.id,
    organizationName: organization.name,
    period: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
    rows,
    totals: {
      opening: roundMoney(rows.reduce((s, r) => s + r.opening, 0)),
      netChange: roundMoney(rows.reduce((s, r) => s + r.netChange, 0)),
      closing: roundMoney(rows.reduce((s, r) => s + r.closing, 0)),
    },
  }
}

