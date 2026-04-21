/**
 * SAK Indonesia (Indonesian Financial Accounting Standards) Financial Reports
 * 
 * Implements:
 * - Laporan Neraca (Balance Sheet)
 * - Laporan Laba Rugi / Laporan Aktivitas
 * - Laporan Aktivitas (For Yayasan/NGOs)
 */

export interface BalanceSheetData {
  orgName: string
  reportDate: Date
  type: 'YAYASAN' | 'PERUSAHAAN'
  
  // ASSETS (AKTIVA)
  assets: {
    current: Array<{ name: string; code: string; amount: number }>
    fixed: Array<{ name: string; code: string; amount: number }>
    other: Array<{ name: string; code: string; amount: number }>
  }
  
  // LIABILITIES (PASSIVA)
  liabilities: {
    current: Array<{ name: string; code: string; amount: number }>
    longTerm: Array<{ name: string; code: string; amount: number }>
  }
  
  // EQUITY / ASET NETO
  equity: Array<{ name: string; code: string; amount: number }>
}

export interface IncomeStatementData {
  orgName: string
  period: { startDate: Date; endDate: Date }
  type: 'YAYASAN' | 'PERUSAHAAN'
  
  // REVENUES
  revenues: Array<{ name: string; code: string; amount: number }>
  
  // EXPENSES
  operatingExpenses: Array<{ name: string; code: string; amount: number }>
  administrativeExpenses: Array<{ name: string; code: string; amount: number }>
  otherExpenses: Array<{ name: string; code: string; amount: number }>
}

/**
 * Calculate Balance Sheet (Neraca) from chart of accounts
 */
export function generateBalanceSheet(
  accounts: any[],
  organizationType: 'YAYASAN' | 'PERUSAHAAN',
  reportDate: Date = new Date()
): BalanceSheetData {
  const assets = {
    current: [] as any[],
    fixed: [] as any[],
    other: [] as any[]
  }
  
  const liabilities = {
    current: [] as any[],
    longTerm: [] as any[]
  }
  
  const equity: any[] = []

  // Categorize accounts based on chart of account type
  accounts.forEach(account => {
    const accountData = {
      name: account.name,
      code: account.code,
      amount: calculateAccountBalance(account)
    }

    if (account.type === 'Asset') {
      if (account.code.startsWith('11')) assets.current.push(accountData)
      else if (account.code.startsWith('12')) assets.fixed.push(accountData)
      else assets.other.push(accountData)
    } else if (account.type === 'Liability') {
      if (account.code.startsWith('21')) liabilities.current.push(accountData)
      else liabilities.longTerm.push(accountData)
    } else if (account.type === 'Equity') {
      equity.push(accountData)
    }
  })

  return {
    orgName: '',
    reportDate,
    type: organizationType,
    assets,
    liabilities,
    equity
  }
}

/**
 * Calculate Income Statement (Laporan Laba Rugi) from transactions
 */
export function generateIncomeStatement(
  accounts: any[],
  transactions: any[],
  startDate: Date,
  endDate: Date,
  organizationType: 'YAYASAN' | 'PERUSAHAAN'
): IncomeStatementData {
  const revenues: any[] = []
  const operatingExpenses: any[] = []
  const administrativeExpenses: any[] = []
  const otherExpenses: any[] = []

  // Filter accounts by type
  accounts.forEach(account => {
    if (account.type === 'Revenue') {
      revenues.push({
        name: account.name,
        code: account.code,
        amount: calculateAccountBalanceForPeriod(account, transactions, startDate, endDate)
      })
    } else if (account.type === 'Expense') {
      const amount = calculateAccountBalanceForPeriod(account, transactions, startDate, endDate)
      
      // Categorize expense accounts
      if (account.code.startsWith('51')) {
        operatingExpenses.push({ name: account.name, code: account.code, amount })
      } else if (account.code.startsWith('52')) {
        administrativeExpenses.push({ name: account.name, code: account.code, amount })
      } else {
        otherExpenses.push({ name: account.name, code: account.code, amount })
      }
    }
  })

  return {
    orgName: '',
    period: { startDate, endDate },
    type: organizationType,
    revenues,
    operatingExpenses,
    administrativeExpenses,
    otherExpenses
  }
}

/**
 * For Yayasan (NGO): Generate Laporan Aktivitas (Activity Report)
 * Different terminology from P&L for non-profit organizations
 */
export function generateActivityReport(
  accounts: any[],
  transactions: any[],
  startDate: Date,
  endDate: Date
): any {
  const incomeStatement = generateIncomeStatement(
    accounts,
    transactions,
    startDate,
    endDate,
    'YAYASAN'
  )

  // Convert P&L terms to Activity Report terms
  return {
    orgName: incomeStatement.orgName,
    period: incomeStatement.period,
    type: 'YAYASAN',
    
    // "Pendapatan" (Revenue)
    inflows: incomeStatement.revenues,
    
    // "Pengeluaran" (Expenses) - grouped by activity
    programs: incomeStatement.operatingExpenses,
    administration: incomeStatement.administrativeExpenses,
    other: incomeStatement.otherExpenses,
    
    // Calculate surplus/deficit
    totalInflow: incomeStatement.revenues.reduce((sum, r) => sum + r.amount, 0),
    totalOutflow: [
      ...incomeStatement.operatingExpenses,
      ...incomeStatement.administrativeExpenses,
      ...incomeStatement.otherExpenses
    ].reduce((sum, e) => sum + e.amount, 0)
  }
}

/**
 * Helper: Calculate account balance from journal entries
 */
export function calculateAccountBalance(account: any): number {
  if (!account.journalItems || account.journalItems.length === 0) {
    return 0
  }

  let balance = 0
  account.journalItems.forEach((item: any) => {
    if (account.type === 'Asset' || account.type === 'Expense') {
      balance += item.debit - item.credit
    } else if (account.type === 'Liability' || account.type === 'Equity' || account.type === 'Revenue') {
      balance += item.credit - item.debit
    }
  })

  return Math.round(balance)
}

/**
 * Helper: Calculate account balance for a specific period
 */
export function calculateAccountBalanceForPeriod(
  account: any,
  transactions: any[],
  startDate: Date,
  endDate: Date
): number {
  let balance = 0

  transactions.forEach(trx => {
    if (new Date(trx.date) >= startDate && new Date(trx.date) <= endDate) {
      trx.lines.forEach((line: any) => {
        if (line.accountId === account.id) {
          if (account.type === 'Asset' || account.type === 'Expense') {
            balance += line.debit - line.credit
          } else {
            balance += line.credit - line.debit
          }
        }
      })
    }
  })

  return Math.round(balance)
}

/**
 * Format Balance Sheet for display
 */
export function formatBalanceSheetForDisplay(data: BalanceSheetData): string {
  const totalCurrentAssets = data.assets.current.reduce((sum, a) => sum + a.amount, 0)
  const totalFixedAssets = data.assets.fixed.reduce((sum, a) => sum + a.amount, 0)
  const totalOtherAssets = data.assets.other.reduce((sum, a) => sum + a.amount, 0)
  const totalAssets = totalCurrentAssets + totalFixedAssets + totalOtherAssets

  const totalCurrentLiabilities = data.liabilities.current.reduce((sum, l) => sum + l.amount, 0)
  const totalLongTermLiabilities = data.liabilities.longTerm.reduce((sum, l) => sum + l.amount, 0)
  const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities

  const totalEquity = data.equity.reduce((sum, e) => sum + e.amount, 0)

  return `
LAPORAN NERACA (BALANCE SHEET)
${data.orgName}
Per ${new Date(data.reportDate).toLocaleDateString('id-ID')}

===== AKTIVA (ASSETS) =====
Aktiva Lancar:
${data.assets.current.map(a => `  ${a.code} ${a.name}: Rp ${a.amount.toLocaleString('id-ID')}`).join('\n')}
Total Aktiva Lancar: Rp ${totalCurrentAssets.toLocaleString('id-ID')}

Aktiva Tetap:
${data.assets.fixed.map(a => `  ${a.code} ${a.name}: Rp ${a.amount.toLocaleString('id-ID')}`).join('\n')}
Total Aktiva Tetap: Rp ${totalFixedAssets.toLocaleString('id-ID')}

Aktiva Lainnya:
${data.assets.other.map(a => `  ${a.code} ${a.name}: Rp ${a.amount.toLocaleString('id-ID')}`).join('\n')}
Total Aktiva Lainnya: Rp ${totalOtherAssets.toLocaleString('id-ID')}

TOTAL AKTIVA: Rp ${totalAssets.toLocaleString('id-ID')}

===== PASSIVA (LIABILITIES & EQUITY) =====
Kewajiban Lancar:
${data.liabilities.current.map(l => `  ${l.code} ${l.name}: Rp ${l.amount.toLocaleString('id-ID')}`).join('\n')}
Total Kewajiban Lancar: Rp ${totalCurrentLiabilities.toLocaleString('id-ID')}

Kewajiban Jangka Panjang:
${data.liabilities.longTerm.map(l => `  ${l.code} ${l.name}: Rp ${l.amount.toLocaleString('id-ID')}`).join('\n')}
Total Kewajiban Jangka Panjang: Rp ${totalLongTermLiabilities.toLocaleString('id-ID')}

Total Kewajiban: Rp ${totalLiabilities.toLocaleString('id-ID')}

${data.type === 'YAYASAN' ? 'Aset Neto:' : 'Ekuitas:'}
${data.equity.map(e => `  ${e.code} ${e.name}: Rp ${e.amount.toLocaleString('id-ID')}`).join('\n')}
Total ${data.type === 'YAYASAN' ? 'Aset Neto' : 'Ekuitas'}: Rp ${totalEquity.toLocaleString('id-ID')}

TOTAL PASSIVA: Rp ${(totalLiabilities + totalEquity).toLocaleString('id-ID')}
  `
}

/**
 * Format Income Statement for display
 */
export function formatIncomeStatementForDisplay(data: IncomeStatementData): string {
  const totalRevenues = data.revenues.reduce((sum, r) => sum + r.amount, 0)
  const totalOperatingExpenses = data.operatingExpenses.reduce((sum, e) => sum + e.amount, 0)
  const totalAdminExpenses = data.administrativeExpenses.reduce((sum, e) => sum + e.amount, 0)
  const totalOtherExpenses = data.otherExpenses.reduce((sum, e) => sum + e.amount, 0)
  const totalExpenses = totalOperatingExpenses + totalAdminExpenses + totalOtherExpenses
  const netIncome = totalRevenues - totalExpenses

  return `
${data.type === 'YAYASAN' ? 'LAPORAN AKTIVITAS (ACTIVITY REPORT)' : 'LAPORAN LABA RUGI (PROFIT & LOSS STATEMENT)'}
${data.orgName}
Periode: ${new Date(data.period.startDate).toLocaleDateString('id-ID')} - ${new Date(data.period.endDate).toLocaleDateString('id-ID')}

===== PENDAPATAN =====
${data.revenues.map(r => `${r.code} ${r.name}: Rp ${r.amount.toLocaleString('id-ID')}`).join('\n')}
TOTAL PENDAPATAN: Rp ${totalRevenues.toLocaleString('id-ID')}

===== PENGELUARAN =====
Pengeluaran Operasional:
${data.operatingExpenses.map(e => `${e.code} ${e.name}: Rp ${e.amount.toLocaleString('id-ID')}`).join('\n')}
Total Operasional: Rp ${totalOperatingExpenses.toLocaleString('id-ID')}

Pengeluaran Administrasi:
${data.administrativeExpenses.map(e => `${e.code} ${e.name}: Rp ${e.amount.toLocaleString('id-ID')}`).join('\n')}
Total Administrasi: Rp ${totalAdminExpenses.toLocaleString('id-ID')}

Pengeluaran Lainnya:
${data.otherExpenses.map(e => `${e.code} ${e.name}: Rp ${e.amount.toLocaleString('id-ID')}`).join('\n')}
Total Lainnya: Rp ${totalOtherExpenses.toLocaleString('id-ID')}

TOTAL PENGELUARAN: Rp ${totalExpenses.toLocaleString('id-ID')}

${data.type === 'YAYASAN' ? 'SURPLUS / (DEFISIT):' : 'LABA / (RUGI) BERSIH:'} Rp ${netIncome.toLocaleString('id-ID')}
  `
}
