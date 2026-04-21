/**
 * Indonesian Tax Calculation Utilities
 * Includes PPh (Personal Income Tax), PPN (Value Added Tax), and Payroll Tax calculations
 */

// PPh Rates 2024 (Indonesian Personal Income Tax Brackets)
export interface TaxBracket {
  minIncome: number
  maxIncome: number | null
  rate: number
}

const PPH_BRACKETS: TaxBracket[] = [
  { minIncome: 0, maxIncome: 60000000, rate: 0.05 },
  { minIncome: 60000000, maxIncome: 250000000, rate: 0.15 },
  { minIncome: 250000000, maxIncome: 500000000, rate: 0.25 },
  { minIncome: 500000000, maxIncome: null, rate: 0.30 }
]

// PTKP (Non-Taxable Income) 2024
export interface PTKP {
  status: 'TK' | 'K' | 'K1' | 'K2' | 'K3'
  spouse: number
  children: number
}

export const PTKP_VALUES: Record<PTKP["status"], number> = {
  'TK': 54000000,      // Single
  'K': 58500000,       // Married
  'K1': 63000000,      // Married + 1 child
  'K2': 67500000,      // Married + 2 children
  'K3': 72000000       // Married + 3 children
}

const DEFAULT_PTKP = 54000000 // TK (Single)

/**
 * Calculate PPh (Personal Income Tax) based on gross income
 * Formula: (Gross Income - PTKP) × Tax Rate
 */
export function calculatePPh(
  grossIncome: number,
  ptkpStatus: keyof typeof PTKP_VALUES = 'TK'
): { pph: number; taxableIncome: number; netto: number } {
  const ptkp = PTKP_VALUES[ptkpStatus] || DEFAULT_PTKP
  const taxableIncome = Math.max(0, grossIncome - ptkp)

  let pph = 0
  let remainingIncome = taxableIncome

  for (const bracket of PPH_BRACKETS) {
    if (remainingIncome <= 0) break

    const bracketSize = bracket.maxIncome
      ? Math.min(remainingIncome, bracket.maxIncome - bracket.minIncome)
      : remainingIncome

    pph += bracketSize * bracket.rate
    remainingIncome -= bracketSize
  }

  return {
    pph: Math.round(pph),
    taxableIncome,
    netto: grossIncome - pph
  }
}

/**
 * Calculate PPN (Value Added Tax) - Standard rate 12%
 * Can also be used for tax-exempt or reduced-rate items
 */
export function calculatePPN(
  amount: number,
  rate: number = 0.12,
  includeTax: boolean = false
): { base: number; tax: number; total: number } {
  if (includeTax) {
    // Amount includes tax, need to extract
    const base = amount / (1 + rate)
    const tax = amount - base
    return {
      base: Math.round(base),
      tax: Math.round(tax),
      total: amount
    }
  } else {
    // Amount is base, calculate tax
    const tax = amount * rate
    return {
      base: amount,
      tax: Math.round(tax),
      total: Math.round(amount + tax)
    }
  }
}

/**
 * Calculate PPh 23 (Corporate Tax) - For payments to contractors, consultants
 * Rate: 2% of gross payment
 */
export function calculatePPh23(amount: number, rate: number = 0.02) {
  return {
    gross: amount,
    pph23: Math.round(amount * rate),
    netto: Math.round(amount - amount * rate)
  }
}

/**
 * Calculate PPh 4 Ayat 2 - For income from services, rent, etc.
 * Rates vary by type of income
 */
export function calculatePPh4(
  amount: number,
  type: 'service' | 'rent' | 'interest' | 'dividend'
): { gross: number; pph4: number; netto: number } {
  const rates: Record<string, number> = {
    'service': 0.06,      // Consulting, architecture, engineering
    'rent': 0.10,         // Rental income
    'interest': 0.10,     // Interest income
    'dividend': 0.10      // Dividend income
  }

  const rate = rates[type] || 0.06
  const pph4 = Math.round(amount * rate)

  return {
    gross: amount,
    pph4,
    netto: amount - pph4
  }
}

/**
 * Calculate employee's monthly payroll deductions and net salary
 * Includes: PPh 21, Health Insurance (BPJS Kesehatan), Pension (BPJS Ketenagakerjaan)
 */
export interface PayrollDeduction {
  grossSalary: number
  bpjsKesehatanEmployee: number  // 4% employee contribution
  bpjsKetenagakerjaan: number     // 2% employee contribution (Jaminan Kecelakaan Kerja)
  pph21: number
  totalDeduction: number
  netSalary: number
}

export function calculatePayrollDeductions(
  grossSalary: number,
  ptkpStatus: keyof typeof PTKP_VALUES = 'TK'
): PayrollDeduction {
  // BPJS Contributions (employee portion)
  const bpjsKesehatanEmployee = Math.round(grossSalary * 0.04)
  const bpjsKetenagakerjaan = Math.round(grossSalary * 0.02)

  // Calculate income for PPh (after BPJS contributions)
  const incomeForTax = grossSalary - bpjsKesehatanEmployee - bpjsKetenagakerjaan
  const { pph: pph21 } = calculatePPh(incomeForTax, ptkpStatus)

  const totalDeduction = bpjsKesehatanEmployee + bpjsKetenagakerjaan + pph21

  return {
    grossSalary,
    bpjsKesehatanEmployee,
    bpjsKetenagakerjaan,
    pph21,
    totalDeduction: Math.round(totalDeduction),
    netSalary: Math.round(grossSalary - totalDeduction)
  }
}

/**
 * Calculate employer's tax obligations
 * Includes: Employer BPJS Kesehatan (4%), BPJS Ketenagakerjaan (0.54%-0.89%), JKM (0.3%)
 */
export interface PayrollTaxObligation {
  grossSalary: number
  bpjsKesehatanEmployer: number  // 4% employer contribution
  bpjsKetenagakerjaan: number    // 0.72% average
  jkm: number                     // 0.3%
  totalEmployerTax: number
}

export function calculatePayrollTaxObligation(
  grossSalary: number
): PayrollTaxObligation {
  const bpjsKesehatanEmployer = Math.round(grossSalary * 0.04)
  const bpjsKetenagakerjaan = Math.round(grossSalary * 0.0072)
  const jkm = Math.round(grossSalary * 0.003)

  return {
    grossSalary,
    bpjsKesehatanEmployer,
    bpjsKetenagakerjaan,
    jkm,
    totalEmployerTax: Math.round(bpjsKesehatanEmployer + bpjsKetenagakerjaan + jkm)
  }
}

/**
 * Calculate tax summary for a transaction
 * Useful for transaction reporting
 */
export interface TransactionTaxSummary {
  transactionAmount: number
  ppnApplicable: boolean
  ppnAmount: number
  pphApplicable: boolean
  pphAmount: number
  totalTax: number
  finalAmount: number
}

export function calculateTransactionTax(
  amount: number,
  applyPPN: boolean = false,
  applyPPh: boolean = false,
  pphType: 'general' | 'service' | 'rent' = 'general'
): TransactionTaxSummary {
  let ppnAmount = 0
  let pphAmount = 0

  if (applyPPN) {
    const ppn = calculatePPN(amount, 0.12)
    ppnAmount = ppn.tax
  }

  if (applyPPh) {
    if (pphType === 'general') {
      pphAmount = Math.round(amount * 0.02) // PPh 23
    } else {
      const result = calculatePPh4(amount, pphType as 'service' | 'rent' | 'interest' | 'dividend')
      pphAmount = result.pph4
    }
  }

  const totalTax = ppnAmount + pphAmount
  const finalAmount = amount + ppnAmount - pphAmount

  return {
    transactionAmount: amount,
    ppnApplicable: applyPPN,
    ppnAmount,
    pphApplicable: applyPPh,
    pphAmount,
    totalTax,
    finalAmount: Math.round(finalAmount)
  }
}

/**
 * Format currency in Indonesian Rupiah
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

/**
 * Format currency without Rp symbol for display in tables
 */
export function formatCurrency(amount: number): string {
  return amount.toLocaleString('id-ID')
}

/**
 * Calculate tax percentage of gross
 */
export function calculateTaxPercentage(
  gross: number,
  tax: number
): number {
  if (gross === 0) return 0
  return Math.round((tax / gross) * 10000) / 100
}
