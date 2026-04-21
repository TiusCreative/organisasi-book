import { Prisma } from '@prisma/client'
import { prisma } from './prisma'

type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense'
type OrganizationType = 'YAYASAN' | 'PERUSAHAAN'

export interface PeriodAccountBalance {
  accountId: string
  code: string
  name: string
  type: AccountType
  balance: number
}

export interface MonthlyPeriod {
  month: number
  year: number
  startDate: Date
  endDate: Date
  startOfYear: Date
}

export interface DateRangePeriod {
  startDate: Date
  endDate: Date
  startOfYear: Date
}

export interface PeriodIncomeStatementReport {
  period: DateRangePeriod
  revenues: PeriodAccountBalance[]
  operatingExpenses: PeriodAccountBalance[]
  administrativeExpenses: PeriodAccountBalance[]
  otherExpenses: PeriodAccountBalance[]
  totalRevenue: number
  totalExpense: number
  netIncome: number
}

export interface PeriodBalanceSheetReport {
  period: DateRangePeriod
  assets: {
    current: PeriodAccountBalance[]
    fixed: PeriodAccountBalance[]
    other: PeriodAccountBalance[]
  }
  liabilities: {
    current: PeriodAccountBalance[]
    longTerm: PeriodAccountBalance[]
  }
  equity: PeriodAccountBalance[]
  currentYearEarnings: number
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
  totalLiabilitiesAndEquity: number
  balanceDifference: number
  balanced: boolean
}

const roundAmount = (value: number) => Math.round(value * 100) / 100

export function getMonthlyPeriod(month: number, year: number): MonthlyPeriod {
  return {
    month,
    year,
    startDate: new Date(year, month - 1, 1),
    endDate: new Date(year, month, 0, 23, 59, 59, 999),
    startOfYear: new Date(year, 0, 1),
  }
}

function classifyExpenseAccount(account: PeriodAccountBalance) {
  if (account.code.startsWith('51')) {
    return 'operating'
  }

  if (account.code.startsWith('52')) {
    return 'administrative'
  }

  return 'other'
}

async function getAccountBalancesByPeriod(
  organizationId: string,
  types: AccountType[],
  dateFilterSql: Prisma.Sql
): Promise<PeriodAccountBalance[]> {
  const rows = await prisma.$queryRaw<Array<{
    accountId: string
    code: string
    name: string
    type: AccountType
    balance: number | null
  }>>(Prisma.sql`
    SELECT
      coa.id AS "accountId",
      coa.code,
      coa.name,
      coa.type,
      COALESCE(
        SUM(
          CASE
            WHEN ${dateFilterSql} AND coa.type = 'Asset' THEN tl.debit - tl.credit
            WHEN ${dateFilterSql} AND coa.type = 'Expense' THEN tl.debit - tl.credit
            WHEN ${dateFilterSql} THEN tl.credit - tl.debit
            ELSE 0
          END
        ),
        0
      ) AS balance
    FROM "ChartOfAccount" coa
    LEFT JOIN "TransactionLine" tl ON tl."accountId" = coa.id
    LEFT JOIN "Transaction" tx ON tx.id = tl."transactionId"
    WHERE coa."organizationId" = ${organizationId}
      AND coa.type IN (${Prisma.join(types)})
    GROUP BY coa.id, coa.code, coa.name, coa.type
    HAVING COALESCE(
      SUM(
        CASE
          WHEN ${dateFilterSql} AND coa.type = 'Asset' THEN tl.debit - tl.credit
          WHEN ${dateFilterSql} AND coa.type = 'Expense' THEN tl.debit - tl.credit
          WHEN ${dateFilterSql} THEN tl.credit - tl.debit
          ELSE 0
        END
      ),
      0
    ) <> 0
    ORDER BY coa.code ASC
  `)

  return rows.map((row) => ({
    accountId: row.accountId,
    code: row.code,
    name: row.name,
    type: row.type,
    balance: roundAmount(Number(row.balance || 0)),
  }))
}

async function getCurrentYearEarnings(
  organizationId: string,
  period: DateRangePeriod
): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ balance: number | null }>>(Prisma.sql`
    SELECT COALESCE(
      SUM(
        CASE
          WHEN coa.type = 'Revenue' THEN tl.credit - tl.debit
          WHEN coa.type = 'Expense' THEN -(tl.debit - tl.credit)
          ELSE 0
        END
      ),
      0
    ) AS balance
    FROM "ChartOfAccount" coa
    LEFT JOIN "TransactionLine" tl ON tl."accountId" = coa.id
    LEFT JOIN "Transaction" tx ON tx.id = tl."transactionId"
    WHERE coa."organizationId" = ${organizationId}
      AND coa.type IN ('Revenue', 'Expense')
      AND tx.date >= ${period.startOfYear}
      AND tx.date <= ${period.endDate}
  `)

  return roundAmount(Number(rows[0]?.balance || 0))
}

function getDateRangePeriod(startDate: Date, endDate: Date): DateRangePeriod {
  return {
    startDate,
    endDate,
    startOfYear: new Date(endDate.getFullYear(), 0, 1),
  }
}

export async function generateIncomeStatementByPeriod(
  organizationId: string,
  month: number,
  year: number
): Promise<PeriodIncomeStatementReport> {
  const period = getMonthlyPeriod(month, year)
  return generateIncomeStatementByDateRange(organizationId, period.startDate, period.endDate)
}

export async function generateIncomeStatementByDateRange(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<PeriodIncomeStatementReport> {
  const period = getDateRangePeriod(startDate, endDate)
  const balances = await getAccountBalancesByPeriod(
    organizationId,
    ['Revenue', 'Expense'],
    Prisma.sql`tx.date >= ${period.startDate} AND tx.date <= ${period.endDate}`
  )

  const revenues = balances.filter((account) => account.type === 'Revenue')
  const expenses = balances.filter((account) => account.type === 'Expense')
  const operatingExpenses = expenses.filter((account) => classifyExpenseAccount(account) === 'operating')
  const administrativeExpenses = expenses.filter((account) => classifyExpenseAccount(account) === 'administrative')
  const otherExpenses = expenses.filter((account) => classifyExpenseAccount(account) === 'other')

  const totalRevenue = roundAmount(revenues.reduce((sum, account) => sum + account.balance, 0))
  const totalExpense = roundAmount(expenses.reduce((sum, account) => sum + account.balance, 0))

  return {
    period,
    revenues,
    operatingExpenses,
    administrativeExpenses,
    otherExpenses,
    totalRevenue,
    totalExpense,
    netIncome: roundAmount(totalRevenue - totalExpense),
  }
}

export async function generateBalanceSheetByPeriod(
  organizationId: string,
  month: number,
  year: number,
  organizationType: OrganizationType = 'PERUSAHAAN'
): Promise<PeriodBalanceSheetReport> {
  const period = getMonthlyPeriod(month, year)
  return generateBalanceSheetByDateRange(organizationId, period.endDate, organizationType, period.startDate)
}

export async function generateBalanceSheetByDateRange(
  organizationId: string,
  endDate: Date,
  organizationType: OrganizationType = 'PERUSAHAAN',
  startDate?: Date
): Promise<PeriodBalanceSheetReport> {
  const period = getDateRangePeriod(startDate || new Date(endDate.getFullYear(), endDate.getMonth(), 1), endDate)
  const balances = await getAccountBalancesByPeriod(
    organizationId,
    ['Asset', 'Liability', 'Equity'],
    Prisma.sql`tx.date <= ${period.endDate}`
  )

  const currentYearEarnings = await getCurrentYearEarnings(organizationId, period)

  const assets = balances.filter((account) => account.type === 'Asset')
  const liabilities = balances.filter((account) => account.type === 'Liability')
  const equity = balances.filter((account) => account.type === 'Equity')

  if (currentYearEarnings !== 0) {
    equity.push({
      accountId: 'current-year-earnings',
      code: organizationType === 'YAYASAN' ? '3300' : '3200',
      name: organizationType === 'YAYASAN' ? 'Aset Neto Tahun Berjalan' : 'Saldo Laba Tahun Berjalan',
      type: 'Equity',
      balance: currentYearEarnings,
    })
  }

  const currentAssets = assets.filter((account) => account.code.startsWith('11') || account.code.startsWith('10'))
  const fixedAssets = assets.filter((account) => account.code.startsWith('12') || account.code.startsWith('15'))
  const otherAssets = assets.filter((account) => !currentAssets.includes(account) && !fixedAssets.includes(account))
  const currentLiabilities = liabilities.filter((account) => account.code.startsWith('21'))
  const longTermLiabilities = liabilities.filter((account) => !currentLiabilities.includes(account))

  const totalAssets = roundAmount(assets.reduce((sum, account) => sum + account.balance, 0))
  const totalLiabilities = roundAmount(liabilities.reduce((sum, account) => sum + account.balance, 0))
  const totalEquity = roundAmount(equity.reduce((sum, account) => sum + account.balance, 0))
  const totalLiabilitiesAndEquity = roundAmount(totalLiabilities + totalEquity)
  const balanceDifference = roundAmount(totalAssets - totalLiabilitiesAndEquity)

  return {
    period,
    assets: {
      current: currentAssets,
      fixed: fixedAssets,
      other: otherAssets,
    },
    liabilities: {
      current: currentLiabilities,
      longTerm: longTermLiabilities,
    },
    equity,
    currentYearEarnings,
    totalAssets,
    totalLiabilities,
    totalEquity,
    totalLiabilitiesAndEquity,
    balanceDifference,
    balanced: Math.abs(balanceDifference) < 0.01,
  }
}
