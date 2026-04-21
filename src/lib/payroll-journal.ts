/**
 * Otomatisasi jurnal akuntansi dari payroll.
 * Slip gaji diposting menjadi transaksi double-entry yang wajib balance.
 */

import { logAudit } from './audit-logger'
import { prisma } from './prisma'

export interface PayrollJournalInput {
  organizationId: string
  employeeId: string
  month: number
  year: number
  baseSalary: number
  totalAllowance: number
  totalDeduction: number
  bpjsKesehatanEmployee: number
  bpjsKetenagakerjaan: number
  pph21: number
  grossIncome: number
  netIncome: number
  salarySlipId: string
  userId?: string
}

export interface JournalEntryLine {
  accountRole?: 'SALARY_EXPENSE' | 'PPH21_PAYABLE' | 'BPJS_PAYABLE' | 'CASH_BANK'
  accountCode: string
  accountName: string
  debit: number
  credit: number
  description: string
}

export interface JournalResult {
  success: boolean
  journalId?: string
  lines: JournalEntryLine[]
  totalDebit: number
  totalCredit: number
  error?: string
}

export const PAYROLL_ACCOUNTS = {
  BEBAN_GAJI: { code: '5100', name: 'Gaji Karyawan' },
  HUTANG_PPH21: { code: '2110', name: 'Hutang PPh 21' },
  HUTANG_BPJS: { code: '2210', name: 'Hutang BPJS Kesehatan' },
  KAS_KECIL: { code: '1001', name: 'Kas Kecil' },
  KAS_BANK: { code: '1100', name: 'Bank - Rekening Utama' },
} as const

const JOURNAL_TOLERANCE = 0.01

function roundAmount(value: number): number {
  return Math.round(value * 100) / 100
}

function normalizeName(value: string | null | undefined): string {
  return (value || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function getPayrollReference(input: PayrollJournalInput): string {
  return `PAYROLL-${input.year}-${String(input.month).padStart(2, '0')}-${input.salarySlipId.substring(0, 8)}`
}

function validatePayrollInput(input: PayrollJournalInput): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!input.organizationId) errors.push('Organization ID wajib')
  if (!input.employeeId) errors.push('Employee ID wajib')
  if (input.month < 1 || input.month > 12) errors.push('Bulan harus 1-12')
  if (input.year < 2000 || input.year > 2100) errors.push('Tahun tidak valid')
  if (input.baseSalary < 0) errors.push('Gaji pokok tidak boleh negatif')
  if (input.totalAllowance < 0) errors.push('Tunjangan tidak boleh negatif')
  if (input.totalDeduction < 0) errors.push('Potongan tidak boleh negatif')

  const expectedGross = roundAmount(input.baseSalary + input.totalAllowance)
  if (Math.abs(input.grossIncome - expectedGross) > JOURNAL_TOLERANCE) {
    errors.push(`Gross income tidak sesuai. Expected: ${expectedGross}, Got: ${input.grossIncome}`)
  }

  const totalDeductions = roundAmount(
    input.totalDeduction + input.bpjsKesehatanEmployee + input.bpjsKetenagakerjaan + input.pph21
  )
  const expectedNet = roundAmount(input.grossIncome - totalDeductions)
  if (Math.abs(input.netIncome - expectedNet) > JOURNAL_TOLERANCE) {
    errors.push(`Net income tidak sesuai. Expected: ${expectedNet}, Got: ${input.netIncome}`)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

function generatePayrollJournalLines(input: PayrollJournalInput): JournalEntryLine[] {
  const lines: JournalEntryLine[] = []
  const description = `Payroll ${input.month}/${input.year} - Employee ID: ${input.employeeId}`
  const salaryExpense = roundAmount(input.baseSalary + input.totalAllowance)
  const bpjsPayable = roundAmount(input.bpjsKesehatanEmployee + input.bpjsKetenagakerjaan)

  if (salaryExpense > 0) {
    lines.push({
      accountRole: 'SALARY_EXPENSE',
      accountCode: PAYROLL_ACCOUNTS.BEBAN_GAJI.code,
      accountName: PAYROLL_ACCOUNTS.BEBAN_GAJI.name,
      debit: salaryExpense,
      credit: 0,
      description: `Beban Gaji dan Tunjangan - ${description}`,
    })
  }

  if (input.pph21 > 0) {
    lines.push({
      accountRole: 'PPH21_PAYABLE',
      accountCode: PAYROLL_ACCOUNTS.HUTANG_PPH21.code,
      accountName: PAYROLL_ACCOUNTS.HUTANG_PPH21.name,
      debit: 0,
      credit: roundAmount(input.pph21),
      description: `Hutang PPh 21 - ${description}`,
    })
  }

  if (bpjsPayable > 0) {
    lines.push({
      accountRole: 'BPJS_PAYABLE',
      accountCode: PAYROLL_ACCOUNTS.HUTANG_BPJS.code,
      accountName: PAYROLL_ACCOUNTS.HUTANG_BPJS.name,
      debit: 0,
      credit: bpjsPayable,
      description: `Hutang BPJS Karyawan - ${description}`,
    })
  }

  if (input.netIncome > 0) {
    lines.push({
      accountRole: 'CASH_BANK',
      accountCode: PAYROLL_ACCOUNTS.KAS_BANK.code,
      accountName: PAYROLL_ACCOUNTS.KAS_BANK.name,
      debit: 0,
      credit: roundAmount(input.netIncome),
      description: `Pembayaran Gaji Bersih - ${description}`,
    })
  }

  return lines
}

function validateBalance(lines: Array<{ debit: number; credit: number }>) {
  const totalDebit = roundAmount(lines.reduce((sum, line) => sum + line.debit, 0))
  const totalCredit = roundAmount(lines.reduce((sum, line) => sum + line.credit, 0))

  return {
    balanced: Math.abs(totalDebit - totalCredit) < JOURNAL_TOLERANCE,
    totalDebit,
    totalCredit,
  }
}

function resolvePayrollAccountId(
  accounts: Array<{ id: string; code: string; name: string; type: string }>,
  bankAccountIds: string[],
  line: JournalEntryLine
): string {
  if (line.accountRole === 'CASH_BANK') {
    const bankOrCashAccount = accounts.find((account) => bankAccountIds.includes(account.id))
      ?? accounts.find((account) => account.code.startsWith(PAYROLL_ACCOUNTS.KAS_BANK.code))
      ?? accounts.find((account) => account.code.startsWith(PAYROLL_ACCOUNTS.KAS_KECIL.code))

    if (!bankOrCashAccount) {
      throw new Error('Akun Kas/Bank untuk payroll tidak ditemukan')
    }

    return bankOrCashAccount.id
  }

  const exactCode = accounts.find((account) => account.code === line.accountCode)
  if (exactCode) {
    return exactCode.id
  }

  const resolved = accounts.find((account) => {
    const accountName = normalizeName(account.name)

    if (line.accountRole === 'SALARY_EXPENSE') {
      return account.type === 'Expense' && (
        accountName.includes('beban gaji') || accountName.includes('gaji')
      )
    }

    if (line.accountRole === 'PPH21_PAYABLE') {
      return account.type === 'Liability' && (
        accountName.includes('hutang pph') || accountName.includes('pph 21')
      )
    }

    if (line.accountRole === 'BPJS_PAYABLE') {
      return account.type === 'Liability' && (
        accountName.includes('hutang bpjs') || accountName.includes('bpjs')
      )
    }

    return false
  })

  if (!resolved) {
    throw new Error(`Akun payroll untuk ${line.accountName} tidak ditemukan`)
  }

  return resolved.id
}

export async function createPayrollJournal(input: PayrollJournalInput): Promise<JournalResult> {
  const validation = validatePayrollInput(input)
  if (!validation.valid) {
    return {
      success: false,
      lines: [],
      totalDebit: 0,
      totalCredit: 0,
      error: validation.errors.join('; '),
    }
  }

  const lines = generatePayrollJournalLines(input)
  const balance = validateBalance(lines)

  if (!balance.balanced) {
    await logAudit({
      organizationId: input.organizationId,
      action: 'CREATE',
      entity: 'PayrollJournal',
      entityId: input.salarySlipId,
      userId: input.userId,
      status: 'FAILED',
      errorMessage: `Journal tidak balance: Debit ${balance.totalDebit} vs Credit ${balance.totalCredit}`,
    })

    return {
      success: false,
      lines,
      totalDebit: balance.totalDebit,
      totalCredit: balance.totalCredit,
      error: `Journal tidak balance: Debit ${balance.totalDebit} vs Credit ${balance.totalCredit}`,
    }
  }

  try {
    const reference = getPayrollReference(input)

    const transaction = await prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findFirst({
        where: {
          organizationId: input.organizationId,
          reference,
        },
      })

      if (existing) {
        return existing
      }

      const organization = await tx.organization.findUnique({
        where: { id: input.organizationId },
        include: {
          accounts: true,
          banks: true,
        },
      })

      if (!organization) {
        throw new Error('Organisasi tidak ditemukan')
      }

      const resolvedLines = lines.map((line) => ({
        accountId: resolvePayrollAccountId(
          organization.accounts,
          organization.banks.map((bank) => bank.accountId),
          line
        ),
        debit: line.debit,
        credit: line.credit,
        description: line.description,
      }))

      const resolvedBalance = validateBalance(resolvedLines)
      if (!resolvedBalance.balanced) {
        throw new Error(`Journal tidak balance: Debit ${resolvedBalance.totalDebit} vs Credit ${resolvedBalance.totalCredit}`)
      }

      return tx.transaction.create({
        data: {
          organizationId: input.organizationId,
          date: new Date(input.year, input.month - 1, 1),
          description: `Jurnal Payroll ${input.month}/${input.year} - Employee: ${input.employeeId}`,
          reference,
          lines: {
            create: resolvedLines,
          },
        },
      })
    })

    await logAudit({
      organizationId: input.organizationId,
      action: 'CREATE',
      entity: 'PayrollJournal',
      entityId: input.salarySlipId,
      userId: input.userId,
      newData: JSON.stringify({
        transactionId: transaction.id,
        lines: lines.length,
      }),
      status: 'SUCCESS',
    })

    return {
      success: true,
      journalId: transaction.id,
      lines,
      totalDebit: balance.totalDebit,
      totalCredit: balance.totalCredit,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    await logAudit({
      organizationId: input.organizationId,
      action: 'CREATE',
      entity: 'PayrollJournal',
      entityId: input.salarySlipId,
      userId: input.userId,
      status: 'FAILED',
      errorMessage,
    })

    return {
      success: false,
      lines,
      totalDebit: balance.totalDebit,
      totalCredit: balance.totalCredit,
      error: `Gagal membuat jurnal: ${errorMessage}`,
    }
  }
}

export async function createDailyTransactionJournal(input: {
  organizationId: string
  description: string
  date: Date
  lines: Array<{
    accountCode: string
    debit: number
    credit: number
    description: string
  }>
  userId?: string
}): Promise<JournalResult> {
  try {
    const total = validateBalance(input.lines)

    if (!total.balanced) {
      await logAudit({
        organizationId: input.organizationId,
        action: 'CREATE',
        entity: 'DailyTransaction',
        entityId: `tx-${Date.now()}`,
        userId: input.userId,
        status: 'FAILED',
        errorMessage: `Transaksi tidak balance: Debit ${total.totalDebit} vs Credit ${total.totalCredit}`,
      })

      return {
        success: false,
        lines: input.lines.map((line) => ({
          accountCode: line.accountCode,
          accountName: line.accountCode,
          debit: line.debit,
          credit: line.credit,
          description: line.description,
        })),
        totalDebit: total.totalDebit,
        totalCredit: total.totalCredit,
        error: `Transaksi tidak balance: Debit ${total.totalDebit} vs Credit ${total.totalCredit}`,
      }
    }

    const resolvedLines = await resolveAccountCodes(
      input.organizationId,
      input.lines.map((line) => ({
        accountCode: line.accountCode,
        accountName: line.accountCode,
        debit: line.debit,
        credit: line.credit,
        description: line.description,
      }))
    )

    const transaction = await prisma.transaction.create({
      data: {
        organizationId: input.organizationId,
        date: input.date,
        description: input.description,
        lines: {
          create: resolvedLines,
        },
      },
    })

    await logAudit({
      organizationId: input.organizationId,
      action: 'CREATE',
      entity: 'DailyTransaction',
      entityId: transaction.id,
      userId: input.userId,
      status: 'SUCCESS',
    })

    return {
      success: true,
      journalId: transaction.id,
      lines: input.lines.map((line) => ({
        accountCode: line.accountCode,
        accountName: line.accountCode,
        debit: line.debit,
        credit: line.credit,
        description: line.description,
      })),
      totalDebit: total.totalDebit,
      totalCredit: total.totalCredit,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    await logAudit({
      organizationId: input.organizationId,
      action: 'CREATE',
      entity: 'DailyTransaction',
      entityId: `tx-${Date.now()}`,
      userId: input.userId,
      status: 'FAILED',
      errorMessage,
    })

    return {
      success: false,
      lines: input.lines.map((line) => ({
        accountCode: line.accountCode,
        accountName: line.accountCode,
        debit: line.debit,
        credit: line.credit,
        description: line.description,
      })),
      totalDebit: 0,
      totalCredit: 0,
      error: `Gagal membuat transaksi: ${errorMessage}`,
    }
  }
}

export async function getAccountByCode(
  organizationId: string,
  code: string
): Promise<string | null> {
  const account = await prisma.chartOfAccount.findFirst({
    where: {
      organizationId,
      code,
    },
  })

  return account?.id || null
}

export async function resolveAccountCodes(
  organizationId: string,
  lines: JournalEntryLine[]
): Promise<Array<{ accountId: string; debit: number; credit: number; description: string }>> {
  const resolvedLines = []

  for (const line of lines) {
    const accountId = await getAccountByCode(organizationId, line.accountCode)
    if (!accountId) {
      throw new Error(`Account code ${line.accountCode} not found`)
    }

    resolvedLines.push({
      accountId,
      debit: line.debit,
      credit: line.credit,
      description: line.description,
    })
  }

  return resolvedLines
}
