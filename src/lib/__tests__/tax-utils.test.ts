/**
 * Unit Tests for Tax & Payroll Calculation Utilities
 * Menggunakan Vitest - tanpa koneksi database (pure function tests)
 *
 * Jalankan:
 *   npm run test:unit
 *   npx vitest run src/lib/__tests__/tax-utils.test.ts
 */

import { describe, it, expect, vi } from 'vitest'
import {
  calculatePPh,
  calculatePPN,
  calculatePPh23,
  calculatePPh4,
  calculatePayrollDeductions,
  calculatePayrollTaxObligation,
  calculateTransactionTax,
  formatRupiah,
  formatCurrency,
  calculateTaxPercentage,
  PTKP_VALUES,
} from '../tax-utils'

describe('calculatePPh - Pajak Penghasilan', () => {
  it('menghitung PPh untuk single (TK) dengan gaji 50 juta', () => {
    const result = calculatePPh(50000000, 'TK')
    expect(result.taxableIncome).toBe(0) // di bawah PTKP 54 juta
    expect(result.pph).toBe(0)
    expect(result.netto).toBe(50000000)
  })

  it('menghitung PPh untuk single dengan gaji 100 juta', () => {
    const result = calculatePPh(100000000, 'TK')
    expect(result.taxableIncome).toBe(46000000) // 100jt - 54jt
    expect(result.pph).toBe(2300000) // 46jt * 5%
    expect(result.netto).toBe(97700000)
  })

  it('menghitung PPh untuk married with 1 child (K1) dengan gaji 200 juta', () => {
    const result = calculatePPh(200000000, 'K1')
    expect(result.taxableIncome).toBe(137000000) // 200jt - 63jt
    // Layer 1: 60jt * 5% = 3jt
    // Layer 2: 77jt * 15% = 11.550.000
    expect(result.pph).toBe(14550000)
    expect(result.netto).toBe(185450000)
  })

  it('menghitung PPh untuk married with 3 children (K3) dengan gaji tinggi', () => {
    const result = calculatePPh(600000000, 'K3')
    expect(result.taxableIncome).toBe(528000000) // 600jt - 72jt
    // Layer 1: 60jt * 5% = 3jt
    // Layer 2: 190jt * 15% = 28.500.000
    // Layer 3: 250jt * 25% = 62.500.000
    // Layer 4: 28jt * 30% = 8.400.000
    expect(result.pph).toBe(102400000)
    expect(result.netto).toBe(497600000)
  })

  it('mengembalikan nol untuk input null atau undefined (fallback ke TK)', () => {
    const resultNull = calculatePPh(0, 'TK')
    expect(resultNull.pph).toBe(0)
    expect(resultNull.taxableIncome).toBe(0)

    const resultSmall = calculatePPh(1000000, 'TK')
    expect(resultSmall.pph).toBe(0)
  })

  it('menggunakan default PTKP jika status tidak valid', () => {
    const result = calculatePPh(100000000, 'INVALID' as any)
    expect(result.taxableIncome).toBe(46000000)
    expect(result.pph).toBe(2300000)
  })
})

describe('calculatePPN - Pajak Pertambahan Nilai', () => {
  it('menghitung PPN 12% dari base amount', () => {
    const result = calculatePPN(1000000, 0.12)
    expect(result.base).toBe(1000000)
    expect(result.tax).toBe(120000)
    expect(result.total).toBe(1120000)
  })

  it('menghitung PPN dengan includeTax (amount sudah termasuk pajak)', () => {
    const result = calculatePPN(1120000, 0.12, true)
    expect(result.base).toBe(1000000)
    expect(result.tax).toBe(120000)
    expect(result.total).toBe(1120000)
  })

  it('menghitung PPN dengan rate default 12%', () => {
    const result = calculatePPN(5000000)
    expect(result.tax).toBe(600000)
    expect(result.total).toBe(5600000)
  })

  it('menangani input nol', () => {
    const result = calculatePPN(0)
    expect(result.tax).toBe(0)
    expect(result.total).toBe(0)
  })
})

describe('calculatePPh23 - Pajak Pemotongan', () => {
  it('menghitung PPh 23 default 2%', () => {
    const result = calculatePPh23(10000000)
    expect(result.pph23).toBe(200000)
    expect(result.netto).toBe(9800000)
  })

  it('menghitung PPh 23 dengan rate custom 4%', () => {
    const result = calculatePPh23(5000000, 0.04)
    expect(result.pph23).toBe(200000)
    expect(result.netto).toBe(4800000)
  })
})

describe('calculatePPh4 - Pajak Final', () => {
  it('menghitung PPh 4 ayat 2 untuk jasa (6%)', () => {
    const result = calculatePPh4(10000000, 'service')
    expect(result.pph4).toBe(600000)
    expect(result.netto).toBe(9400000)
  })

  it('menghitung PPh 4 ayat 2 untuk sewa (10%)', () => {
    const result = calculatePPh4(10000000, 'rent')
    expect(result.pph4).toBe(1000000)
    expect(result.netto).toBe(9000000)
  })

  it('menghitung PPh 4 ayat 2 untuk bunga (10%)', () => {
    const result = calculatePPh4(5000000, 'interest')
    expect(result.pph4).toBe(500000)
    expect(result.netto).toBe(4500000)
  })

  it('menghitung PPh 4 ayat 2 untuk dividen (10%)', () => {
    const result = calculatePPh4(100000000, 'dividend')
    expect(result.pph4).toBe(10000000)
    expect(result.netto).toBe(90000000)
  })

  it('menggunakan default rate 6% untuk type tidak valid', () => {
    const result = calculatePPh4(10000000, 'unknown' as any)
    expect(result.pph4).toBe(600000)
  })
})

describe('calculatePayrollDeductions - Potongan Gaji Karyawan', () => {
  it('menghitung potongan untuk gaji 15 juta (TK)', () => {
    const result = calculatePayrollDeductions(15000000, 'TK')
    expect(result.grossSalary).toBe(15000000)
    expect(result.bpjsKesehatanEmployee).toBe(600000) // 4%
    expect(result.bpjsKetenagakerjaan).toBe(300000) // 2%
    expect(result.totalDeduction).toBeGreaterThan(0)
    expect(result.netSalary).toBeLessThan(15000000)
    expect(result.netSalary).toBeGreaterThan(0)
  })

  it('menghitung potongan untuk gaji 25 juta (K1)', () => {
    const result = calculatePayrollDeductions(25000000, 'K1')
    expect(result.grossSalary).toBe(25000000)
    expect(result.bpjsKesehatanEmployee).toBe(1000000)
    expect(result.bpjsKetenagakerjaan).toBe(500000)
    expect(result.netSalary).toBeGreaterThan(0)
  })

  it('menghasilkan zero deductions untuk gaji nol', () => {
    const result = calculatePayrollDeductions(0, 'TK')
    expect(result.bpjsKesehatanEmployee).toBe(0)
    expect(result.bpjsKetenagakerjaan).toBe(0)
    expect(result.pph21).toBe(0)
    expect(result.totalDeduction).toBe(0)
    expect(result.netSalary).toBe(0)
  })

  it('total deduction tidak melebihi gross salary', () => {
    const result = calculatePayrollDeductions(5000000, 'TK')
    expect(result.totalDeduction).toBeLessThanOrEqual(result.grossSalary)
    expect(result.netSalary).toBeGreaterThanOrEqual(0)
  })
})

describe('calculatePayrollTaxObligation - Kewajiban Pajak Perusahaan', () => {
  it('menghitung kontribusi employer untuk gaji 20 juta', () => {
    const result = calculatePayrollTaxObligation(20000000)
    expect(result.bpjsKesehatanEmployer).toBe(800000) // 4%
    expect(result.bpjsKetenagakerjaan).toBe(144000) // 0.72%
    expect(result.jkm).toBe(60000) // 0.3%
    expect(result.totalEmployerTax).toBe(800000 + 144000 + 60000)
  })

  it('menghasilkan nol untuk gaji nol', () => {
    const result = calculatePayrollTaxObligation(0)
    expect(result.totalEmployerTax).toBe(0)
    expect(result.bpjsKesehatanEmployer).toBe(0)
  })
})

describe('calculateTransactionTax - Pajak Transaksi', () => {
  it('menghitung PPN saja', () => {
    const result = calculateTransactionTax(1000000, true)
    expect(result.ppnAmount).toBe(120000)
    expect(result.pphAmount).toBe(0)
    expect(result.totalTax).toBe(120000)
    expect(result.finalAmount).toBe(1120000)
  })

  it('menghitung PPh 23 saja', () => {
    const result = calculateTransactionTax(1000000, false, true, 'general')
    expect(result.ppnAmount).toBe(0)
    expect(result.pphAmount).toBe(20000) // 2%
    expect(result.totalTax).toBe(20000)
    expect(result.finalAmount).toBe(980000)
  })

  it('menghitung PPN + PPh secara bersamaan', () => {
    const result = calculateTransactionTax(1000000, true, true, 'general')
    expect(result.ppnAmount).toBe(120000)
    expect(result.pphAmount).toBe(20000)
    expect(result.totalTax).toBe(140000)
    expect(result.finalAmount).toBe(1100000) // 1jt + 120k - 20k
  })

  it('menghitung PPh 4 ayat 2 untuk jasa', () => {
    const result = calculateTransactionTax(1000000, false, true, 'service')
    expect(result.pphAmount).toBe(60000) // 6%
  })

  it('menghasilkan nol tax jika tidak ada flag', () => {
    const result = calculateTransactionTax(1000000)
    expect(result.ppnAmount).toBe(0)
    expect(result.pphAmount).toBe(0)
    expect(result.totalTax).toBe(0)
    expect(result.finalAmount).toBe(1000000)
  })
})

describe('Format Helpers', () => {
  it('formatRupiah memformat dengan simbol Rp', () => {
    expect(formatRupiah(1500000)).toContain('Rp')
    expect(formatRupiah(1500000)).toContain('1.500.000')
  })

  it('formatCurrency tanpa simbol', () => {
    expect(formatCurrency(2500000)).toBe('2.500.000')
    expect(formatCurrency(0)).toBe('0')
  })

  it('calculateTaxPercentage menghitung persentase dengan benar', () => {
    expect(calculateTaxPercentage(1000000, 200000)).toBe(20)
    expect(calculateTaxPercentage(1000000, 0)).toBe(0)
    expect(calculateTaxPercentage(0, 0)).toBe(0)
  })
})

describe('PTKP Values', () => {
  it('memiliki nilai PTKP yang valid', () => {
    expect(PTKP_VALUES.TK).toBe(54000000)
    expect(PTKP_VALUES.K).toBe(58500000)
    expect(PTKP_VALUES.K1).toBe(63000000)
    expect(PTKP_VALUES.K2).toBe(67500000)
    expect(PTKP_VALUES.K3).toBe(72000000)
  })
})
