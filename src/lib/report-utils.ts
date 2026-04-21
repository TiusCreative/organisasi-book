import { formatDateRange } from "./date-range"

// Utility untuk generate laporan keuangan

export interface ReportData {
  title: string
  description: string
  data: any[]
  totals?: any
}

export const reportTypes = {
  TRANSACTIONS: 'transactions',
  BANK: 'bank',
  INCOME: 'income',
  EXPENSE: 'expense',
  PROFIT_LOSS: 'profit_loss',
  GENERAL_LEDGER: 'general_ledger',
  BALANCE_SHEET: 'balance_sheet'
}

function getBankLine(trx: any, bankAccountIds: Set<string>) {
  return trx.lines.find((line: any) => bankAccountIds.has(line.accountId))
}

function getCategoryLine(trx: any, bankAccountIds: Set<string>) {
  return trx.lines.find((line: any) => !bankAccountIds.has(line.accountId))
}

export const generateTransactionReport = (
  transactions: any[],
  startDate: Date,
  endDate: Date,
  bankAccountIds: Set<string>
): ReportData => {
  const totalIncome = transactions.reduce((sum, trx) => {
    const incomeLine = getBankLine(trx, bankAccountIds)
    if (!incomeLine || incomeLine.debit <= 0) {
      return sum
    }
    return sum + (incomeLine?.debit || 0)
  }, 0)

  const totalExpense = transactions.reduce((sum, trx) => {
    const expenseLine = getBankLine(trx, bankAccountIds)
    if (!expenseLine || expenseLine.credit <= 0) {
      return sum
    }
    return sum + (expenseLine?.credit || 0)
  }, 0)

  return {
    title: 'Laporan Transaksi',
    description: `Periode: ${formatDateRange(startDate, endDate)}`,
    data: transactions.map((trx) => ({
      ...trx,
      reportBankLine: getBankLine(trx, bankAccountIds),
      reportCategoryLine: getCategoryLine(trx, bankAccountIds),
    })),
    totals: {
      income: totalIncome,
      expense: totalExpense,
      net: totalIncome - totalExpense
    }
  }
}

export const generateBankReport = (bankAccounts: any[], _startDate: Date, endDate: Date): ReportData => {
  return {
    title: 'Laporan Bank & Kas',
    description: `Posisi saldo per ${endDate.toLocaleDateString('id-ID')}`,
    data: bankAccounts,
    totals: {
      totalBalance: bankAccounts.reduce((sum, b) => sum + (b.balance || 0), 0)
    }
  }
}

export const generateIncomeReport = (
  transactions: any[],
  startDate: Date,
  endDate: Date,
  bankAccountIds: Set<string>
): ReportData => {
  const incomeTransactions = transactions.filter(trx => 
    trx.lines.some((line: any) => bankAccountIds.has(line.accountId) && line.debit > 0)
  )

  const totalIncome = incomeTransactions.reduce((sum, trx) => {
    const incomeLine = getBankLine(trx, bankAccountIds)
    return sum + (incomeLine?.debit || 0)
  }, 0)

  return {
    title: 'Laporan Penerimaan',
    description: `Periode: ${formatDateRange(startDate, endDate)}`,
    data: incomeTransactions.map((trx) => ({
      ...trx,
      reportBankLine: getBankLine(trx, bankAccountIds),
      reportCategoryLine: getCategoryLine(trx, bankAccountIds),
    })),
    totals: {
      totalIncome
    }
  }
}

export const generateExpenseReport = (
  transactions: any[],
  startDate: Date,
  endDate: Date,
  bankAccountIds: Set<string>
): ReportData => {
  const expenseTransactions = transactions.filter(trx => 
    trx.lines.some((line: any) => bankAccountIds.has(line.accountId) && line.credit > 0)
  )

  const totalExpense = expenseTransactions.reduce((sum, trx) => {
    const expenseLine = getBankLine(trx, bankAccountIds)
    return sum + (expenseLine?.credit || 0)
  }, 0)

  return {
    title: 'Laporan Pengeluaran',
    description: `Periode: ${formatDateRange(startDate, endDate)}`,
    data: expenseTransactions.map((trx) => ({
      ...trx,
      reportBankLine: getBankLine(trx, bankAccountIds),
      reportCategoryLine: getCategoryLine(trx, bankAccountIds),
    })),
    totals: {
      totalExpense
    }
  }
}

export const generateProfitLossReport = (
  transactions: any[],
  org: any,
  startDate: Date,
  endDate: Date,
  bankAccountIds: Set<string>
): ReportData => {
  const totalIncome = transactions.reduce((sum, trx) => {
    const incomeLine = getBankLine(trx, bankAccountIds)
    if (!incomeLine || incomeLine.debit <= 0) {
      return sum
    }
    return sum + (incomeLine?.debit || 0)
  }, 0)

  const totalExpense = transactions.reduce((sum, trx) => {
    const expenseLine = getBankLine(trx, bankAccountIds)
    if (!expenseLine || expenseLine.credit <= 0) {
      return sum
    }
    return sum + (expenseLine?.credit || 0)
  }, 0)

  const netIncome = totalIncome - totalExpense

  return {
    title: org?.type === 'YAYASAN' ? 'Laporan Aktivitas' : 'Laporan Laba Rugi',
    description: `${org?.name || 'Organisasi'} - ${formatDateRange(startDate, endDate)}`,
    data: [
      { label: org?.type === 'YAYASAN' ? 'Penerimaan' : 'Pendapatan', amount: totalIncome },
      { label: org?.type === 'YAYASAN' ? 'Pengeluaran' : 'Biaya/Pengeluaran', amount: totalExpense },
      { label: org?.type === 'YAYASAN' ? 'Surplus / Defisit' : 'Laba Bersih', amount: netIncome }
    ],
    totals: {
      income: totalIncome,
      expense: totalExpense,
      netIncome
    }
  }
}

export const generateGeneralLedger = (accounts: any[], startDate: Date, endDate: Date): ReportData => {
  const ledgerData = accounts.map(acc => {
    const totalDebit = acc.journalItems?.reduce((sum: number, item: any) => sum + item.debit, 0) || 0
    const totalCredit = acc.journalItems?.reduce((sum: number, item: any) => sum + item.credit, 0) || 0
    const balance = totalDebit - totalCredit

    return {
      code: acc.code,
      name: acc.name,
      type: acc.type,
      debit: totalDebit,
      credit: totalCredit,
      balance
    }
  })

  const totals = {
    totalDebit: ledgerData.reduce((sum, item) => sum + item.debit, 0),
    totalCredit: ledgerData.reduce((sum, item) => sum + item.credit, 0)
  }

  return {
    title: 'Laporan Buku Besar',
    description: `Periode: ${formatDateRange(startDate, endDate)}`,
    data: ledgerData,
    totals
  }
}
