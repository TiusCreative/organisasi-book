/**
 * Financial Reports Generator - SAK Indonesia Standard
 * Laporan Neraca (Balance Sheet) & Laporan Laba Rugi (Income Statement)
 * Dengan dukungan Yayasan (Laporan Aktivitas)
 */

import { prisma } from './prisma'

export interface ReportPeriod {
  startDate: Date
  endDate: Date
}

export interface AccountBalance {
  code: string
  name: string
  type: string
  balance: number
  subAccounts?: AccountBalance[]
}

export interface BalanceSheetReport {
  organizationId: string
  organizationName: string
  organizationType: string
  reportDate: Date
  assets: {
    current: AccountBalance[]
    currentTotal: number
    fixed: AccountBalance[]
    fixedTotal: number
    other: AccountBalance[]
    otherTotal: number
    total: number
  }
  liabilities: {
    current: AccountBalance[]
    currentTotal: number
    longTerm: AccountBalance[]
    longTermTotal: number
    total: number
  }
  equity: {
    capital: AccountBalance[]
    capitalTotal: number
    earnings: AccountBalance
    retainedEarnings: AccountBalance
    currentYearProfit: number
    total: number
  }
  totalLiabilitiesAndEquity: number
  balanced: boolean
  balanceDifference: number
}

export interface IncomeStatementReport {
  organizationId: string
  organizationName: string
  organizationType: string
  reportPeriod: ReportPeriod
  revenues: AccountBalance[]
  totalRevenues: number
  operatingExpenses: AccountBalance[]
  operatingExpensesTotal: number
  administrativeExpenses: AccountBalance[]
  administrativeExpensesTotal: number
  otherExpenses: AccountBalance[]
  otherExpensesTotal: number
  totalExpenses: number
  netProfit: number
  taxExpense: number
  netProfitAfterTax: number
}

export interface ActivityReportReport {
  organizationId: string
  organizationName: string
  reportPeriod: ReportPeriod
  inflows: AccountBalance[]
  totalInflows: number
  programExpenses: AccountBalance[]
  programExpensesTotal: number
  administrativeExpenses: AccountBalance[]
  administrativeExpensesTotal: number
  otherExpenses: AccountBalance[]
  otherExpensesTotal: number
  totalOutflows: number
  netActivity: number
}

/**
 * Calculate account balance from transactions
 */
async function calculateAccountBalance(
  accountId: string,
  startDate?: Date,
  endDate?: Date
): Promise<number> {
  const transactions = await prisma.transactionLine.findMany({
    where: {
      accountId,
      transaction: {
        date: {
          ...(startDate && { gte: startDate }),
          ...(endDate && { lte: endDate }),
        },
      },
    },
    include: {
      transaction: true,
    },
  })

  return transactions.reduce((balance, line) => {
    return balance + (line.debit - line.credit)
  }, 0)
}

/**
 * Get accounts by category
 */
async function getAccountsByCategory(
  organizationId: string,
  accountTypes: string[]
): Promise<AccountBalance[]> {
  const accounts = await prisma.chartOfAccount.findMany({
    where: {
      organizationId,
      type: {
        in: accountTypes,
      },
    },
    orderBy: [{ code: 'asc' }],
    include: {
      journalItems: true,
    },
  })

  const balances: AccountBalance[] = []

  for (const account of accounts) {
    const balance = account.journalItems.reduce((sum, line) => {
      return sum + (line.debit - line.credit)
    }, 0)

    if (balance !== 0 || !account.isHeader) {
      balances.push({
        code: account.code,
        name: account.name,
        type: account.type,
        balance,
      })
    }
  }

  return balances
}

/**
 * Generate Balance Sheet (Laporan Neraca)
 */
export async function generateBalanceSheet(
  organizationId: string,
  reportDate: Date = new Date()
): Promise<BalanceSheetReport> {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
  })

  // Get all accounts as of report date
  const assets = await getAccountsByCategory(organizationId, ['Asset'])
  const liabilities = await getAccountsByCategory(organizationId, ['Liability'])
  const equities = await getAccountsByCategory(organizationId, ['Equity'])

  // Categorize assets
  const currentAssets = assets.filter((a) => a.code?.startsWith('1001'))
  const fixedAssets = assets.filter((a) => a.code?.startsWith('1010'))
  const otherAssets = assets.filter((a) => !a.code?.startsWith('1001') && !a.code?.startsWith('1010'))

  const currentAssetTotal = currentAssets.reduce((sum, a) => sum + a.balance, 0)
  const fixedAssetTotal = fixedAssets.reduce((sum, a) => sum + a.balance, 0)
  const otherAssetTotal = otherAssets.reduce((sum, a) => sum + a.balance, 0)
  const totalAssets = currentAssetTotal + fixedAssetTotal + otherAssetTotal

  // Categorize liabilities
  const currentLiabilities = liabilities.filter((l) => l.code?.startsWith('2001'))
  const longTermLiabilities = liabilities.filter((l) => !l.code?.startsWith('2001'))

  const currentLiabilitiesTotal = currentLiabilities.reduce((sum, l) => sum + l.balance, 0)
  const longTermLiabilitiesTotal = longTermLiabilities.reduce((sum, l) => sum + l.balance, 0)
  const totalLiabilities = currentLiabilitiesTotal + longTermLiabilitiesTotal

  // Categorize equity
  const capitalEquity = equities.filter((e) => e.code?.startsWith('3001'))
  const otherEquity = equities.filter((e) => !e.code?.startsWith('3001'))

  const capitalTotal = capitalEquity.reduce((sum, e) => sum + e.balance, 0)

  // Calculate current year profit (from income statement)
  const currentYear = reportDate.getFullYear()
  const yearStartDate = new Date(currentYear, 0, 1)
  const currentYearProfit = await calculateNetProfit(organizationId, yearStartDate, reportDate)

  const retainedEarningsAccount =
    equities.find((e) => e.code === '3003') || {
      code: '3003',
      name: 'Saldo Laba Ditahan',
      type: 'Equity',
      balance: 0,
    }

  const totalEquity = capitalTotal + retainedEarningsAccount.balance + currentYearProfit
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity

  const balanceDifference = totalAssets - totalLiabilitiesAndEquity

  return {
    organizationId,
    organizationName: organization.name,
    organizationType: organization.type,
    reportDate,
    assets: {
      current: currentAssets,
      currentTotal: currentAssetTotal,
      fixed: fixedAssets,
      fixedTotal: fixedAssetTotal,
      other: otherAssets,
      otherTotal: otherAssetTotal,
      total: totalAssets,
    },
    liabilities: {
      current: currentLiabilities,
      currentTotal: currentLiabilitiesTotal,
      longTerm: longTermLiabilities,
      longTermTotal: longTermLiabilitiesTotal,
      total: totalLiabilities,
    },
    equity: {
      capital: capitalEquity,
      capitalTotal,
      earnings: retainedEarningsAccount,
      retainedEarnings: retainedEarningsAccount,
      currentYearProfit,
      total: totalEquity,
    },
    totalLiabilitiesAndEquity,
    balanced: Math.abs(balanceDifference) < 0.01,
    balanceDifference,
  }
}

/**
 * Calculate net profit for period
 */
async function calculateNetProfit(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const revenues = await getAccountsByCategory(organizationId, ['Revenue'])
  const expenses = await getAccountsByCategory(organizationId, ['Expense'])

  const revenueBalance = revenues.reduce((sum, r) => sum + r.balance, 0)
  const expenseBalance = expenses.reduce((sum, e) => sum + e.balance, 0)

  // Profit = Revenue - Expense (in accounting, expenses are negative)
  return revenueBalance - expenseBalance
}

/**
 * Generate Income Statement (Laporan Laba Rugi)
 */
export async function generateIncomeStatement(
  organizationId: string,
  period: ReportPeriod
): Promise<IncomeStatementReport> {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
  })

  // Get all revenue and expense accounts for period
  const transactions = await prisma.transaction.findMany({
    where: {
      organizationId,
      date: {
        gte: period.startDate,
        lte: period.endDate,
      },
    },
    include: {
      lines: {
        include: {
          account: true,
        },
      },
    },
  })

  // Calculate balances by account for the period
  const accountBalances = new Map<string, { name: string; balance: number; type: string; code: string }>()

  transactions.forEach((tx) => {
    tx.lines.forEach((line) => {
      const key = line.accountId
      if (!accountBalances.has(key)) {
        accountBalances.set(key, {
          name: line.account.name,
          balance: 0,
          type: line.account.type,
          code: line.account.code,
        })
      }
      const acc = accountBalances.get(key)!
      acc.balance += line.debit - line.credit
    })
  })

  // Separate revenues and expenses
  const revenues: AccountBalance[] = []
  const operatingExpenses: AccountBalance[] = []
  const administrativeExpenses: AccountBalance[] = []
  const otherExpenses: AccountBalance[] = []
  let taxExpense = 0

  accountBalances.forEach((acc) => {
    const balance = Math.abs(acc.balance) // Revenue and expense amounts are positive
    const accountBalance: AccountBalance = {
      code: acc.code,
      name: acc.name,
      type: acc.type,
      balance,
    }

    if (acc.type === 'Revenue') {
      revenues.push(accountBalance)
    } else if (acc.type === 'Expense') {
      if (acc.code?.startsWith('5101') || acc.code?.startsWith('5102')) {
        // Operating expenses
        operatingExpenses.push(accountBalance)
      } else if (acc.code?.startsWith('5103') || acc.code?.startsWith('5104')) {
        // Administrative expenses
        administrativeExpenses.push(accountBalance)
      } else if (acc.code?.startsWith('5301')) {
        // Tax expense
        taxExpense += balance
      } else {
        // Other expenses
        otherExpenses.push(accountBalance)
      }
    }
  })

  const totalRevenues = revenues.reduce((sum, r) => sum + r.balance, 0)
  const operatingExpensesTotal = operatingExpenses.reduce((sum, e) => sum + e.balance, 0)
  const administrativeExpensesTotal = administrativeExpenses.reduce((sum, e) => sum + e.balance, 0)
  const otherExpensesTotal = otherExpenses.reduce((sum, e) => sum + e.balance, 0)
  const totalExpenses = operatingExpensesTotal + administrativeExpensesTotal + otherExpensesTotal + taxExpense

  const netProfit = totalRevenues - totalExpenses
  const netProfitAfterTax = netProfit - taxExpense

  return {
    organizationId,
    organizationName: organization.name,
    organizationType: organization.type,
    reportPeriod: period,
    revenues,
    totalRevenues,
    operatingExpenses,
    operatingExpensesTotal,
    administrativeExpenses,
    administrativeExpensesTotal,
    otherExpenses,
    otherExpensesTotal,
    totalExpenses,
    netProfit,
    taxExpense,
    netProfitAfterTax,
  }
}

/**
 * Generate Activity Report (Laporan Aktivitas untuk Yayasan)
 */
export async function generateActivityReport(
  organizationId: string,
  period: ReportPeriod
): Promise<ActivityReportReport> {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
  })

  const incomeStatement = await generateIncomeStatement(organizationId, period)

  return {
    organizationId,
    organizationName: organization.name,
    reportPeriod: period,
    inflows: incomeStatement.revenues,
    totalInflows: incomeStatement.totalRevenues,
    programExpenses: incomeStatement.operatingExpenses,
    programExpensesTotal: incomeStatement.operatingExpensesTotal,
    administrativeExpenses: incomeStatement.administrativeExpenses,
    administrativeExpensesTotal: incomeStatement.administrativeExpensesTotal,
    otherExpenses: incomeStatement.otherExpenses,
    otherExpensesTotal: incomeStatement.otherExpensesTotal,
    totalOutflows: incomeStatement.totalExpenses,
    netActivity: incomeStatement.netProfit,
  }
}

/**
 * Format balance sheet untuk display/print
 */
export function formatBalanceSheetForDisplay(report: BalanceSheetReport): string {
  const lines: string[] = []

  lines.push(`${report.organizationName}`)
  lines.push(`LAPORAN POSISI KEUANGAN (NERACA)`)
  lines.push(`Tanggal: ${report.reportDate.toLocaleDateString('id-ID')}`)
  lines.push('')

  // Assets
  lines.push(`AKTIVA`)
  lines.push(`  Aktiva Lancar:`)
  report.assets.current.forEach((a) => {
    lines.push(`    ${a.code} ${a.name}                 Rp ${a.balance.toLocaleString('id-ID')}`)
  })
  lines.push(`  Total Aktiva Lancar                     Rp ${report.assets.currentTotal.toLocaleString('id-ID')}`)
  lines.push('')

  lines.push(`  Aktiva Tetap:`)
  report.assets.fixed.forEach((a) => {
    lines.push(`    ${a.code} ${a.name}                 Rp ${a.balance.toLocaleString('id-ID')}`)
  })
  lines.push(`  Total Aktiva Tetap                      Rp ${report.assets.fixedTotal.toLocaleString('id-ID')}`)
  lines.push('')

  lines.push(`  Aktiva Lainnya:`)
  report.assets.other.forEach((a) => {
    lines.push(`    ${a.code} ${a.name}                 Rp ${a.balance.toLocaleString('id-ID')}`)
  })
  lines.push(`  Total Aktiva Lainnya                    Rp ${report.assets.otherTotal.toLocaleString('id-ID')}`)
  lines.push('')

  lines.push(`TOTAL AKTIVA                            Rp ${report.assets.total.toLocaleString('id-ID')}`)
  lines.push('')
  lines.push('')

  // Liabilities & Equity
  lines.push(`PASSIVA`)
  lines.push(`  Kewajiban Lancar:`)
  report.liabilities.current.forEach((l) => {
    lines.push(`    ${l.code} ${l.name}                Rp ${l.balance.toLocaleString('id-ID')}`)
  })
  lines.push(`  Total Kewajiban Lancar                  Rp ${report.liabilities.currentTotal.toLocaleString('id-ID')}`)
  lines.push('')

  lines.push(`  Kewajiban Jangka Panjang:`)
  report.liabilities.longTerm.forEach((l) => {
    lines.push(`    ${l.code} ${l.name}                Rp ${l.balance.toLocaleString('id-ID')}`)
  })
  lines.push(`  Total Kewajiban Jangka Panjang          Rp ${report.liabilities.longTermTotal.toLocaleString('id-ID')}`)
  lines.push('')

  lines.push(`TOTAL KEWAJIBAN                         Rp ${report.liabilities.total.toLocaleString('id-ID')}`)
  lines.push('')

  lines.push(`  Modal:`)
  report.equity.capital.forEach((e) => {
    lines.push(`    ${e.code} ${e.name}                 Rp ${e.balance.toLocaleString('id-ID')}`)
  })
  lines.push(`  Total Modal                             Rp ${report.equity.capitalTotal.toLocaleString('id-ID')}`)
  lines.push(`  Saldo Laba Ditahan                      Rp ${report.equity.retainedEarnings.balance.toLocaleString('id-ID')}`)
  lines.push(`  Laba Tahun Berjalan                     Rp ${report.equity.currentYearProfit.toLocaleString('id-ID')}`)
  lines.push(`  Total Ekuitas                           Rp ${report.equity.total.toLocaleString('id-ID')}`)
  lines.push('')

  lines.push(`TOTAL PASSIVA & EKUITAS                 Rp ${report.totalLiabilitiesAndEquity.toLocaleString('id-ID')}`)
  lines.push('')

  if (report.balanced) {
    lines.push(`✓ Laporan Neraca SEIMBANG`)
  } else {
    lines.push(`⚠ Laporan Neraca TIDAK SEIMBANG`)
    lines.push(`  Selisih: Rp ${report.balanceDifference.toLocaleString('id-ID')}`)
  }

  return lines.join('\n')
}

/**
 * Format income statement untuk display/print
 */
export function formatIncomeStatementForDisplay(report: IncomeStatementReport): string {
  const lines: string[] = []

  lines.push(`${report.organizationName}`)
  lines.push(`LAPORAN LABA RUGI`)
  lines.push(
    `Periode: ${report.reportPeriod.startDate.toLocaleDateString('id-ID')} - ${report.reportPeriod.endDate.toLocaleDateString('id-ID')}`
  )
  lines.push('')

  lines.push(`PENDAPATAN:`)
  report.revenues.forEach((r) => {
    lines.push(`  ${r.code} ${r.name}                     Rp ${r.balance.toLocaleString('id-ID')}`)
  })
  lines.push(`Total Pendapatan                        Rp ${report.totalRevenues.toLocaleString('id-ID')}`)
  lines.push('')

  lines.push(`BEBAN OPERASIONAL:`)
  report.operatingExpenses.forEach((e) => {
    lines.push(`  ${e.code} ${e.name}                     Rp ${e.balance.toLocaleString('id-ID')}`)
  })
  lines.push(`Total Beban Operasional                 Rp ${report.operatingExpensesTotal.toLocaleString('id-ID')}`)
  lines.push('')

  lines.push(`BEBAN ADMINISTRASI:`)
  report.administrativeExpenses.forEach((e) => {
    lines.push(`  ${e.code} ${e.name}                     Rp ${e.balance.toLocaleString('id-ID')}`)
  })
  lines.push(`Total Beban Administrasi                Rp ${report.administrativeExpensesTotal.toLocaleString('id-ID')}`)
  lines.push('')

  lines.push(`BEBAN LAINNYA:`)
  report.otherExpenses.forEach((e) => {
    lines.push(`  ${e.code} ${e.name}                     Rp ${e.balance.toLocaleString('id-ID')}`)
  })
  lines.push(`Total Beban Lainnya                     Rp ${report.otherExpensesTotal.toLocaleString('id-ID')}`)
  lines.push('')

  lines.push(`Total Beban                             Rp ${report.totalExpenses.toLocaleString('id-ID')}`)
  lines.push('')

  lines.push(`LABA OPERASIONAL                        Rp ${report.netProfit.toLocaleString('id-ID')}`)

  if (report.taxExpense > 0) {
    lines.push(`Beban Pajak                             Rp ${report.taxExpense.toLocaleString('id-ID')}`)
    lines.push(`LABA BERSIH SETELAH PAJAK               Rp ${report.netProfitAfterTax.toLocaleString('id-ID')}`)
  }

  return lines.join('\n')
}
