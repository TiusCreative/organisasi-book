/**
 * Dummy Data Seed Script
 * Safe to run multiple times - uses checks to avoid duplicates
 * Seeds: 10+ ledger transactions, 5+ employees with payroll data
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { config } from 'dotenv'

config()

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL as string,
  }),
})

async function main() {
  console.log('🌱 Memulai seeding data dummy...')

  // Ambil organisasi pertama yang sudah ada
  const org = await prisma.organization.findFirst()
  if (!org) {
    console.error('❌ Tidak ada organisasi. Jalankan seed utama terlebih dahulu (npm run seed).')
    process.exit(1)
  }

  console.log(`📌 Menggunakan organisasi: ${org.name} (${org.id})`)

  // --- 1. SEED CHART OF ACCOUNTS (pastikan akun kunci tersedia) ---
  const requiredAccounts = [
    { code: '1001', name: 'Kas Kecil', type: 'Asset' },
    { code: '1002', name: 'Bank', type: 'Asset' },
    { code: '1101', name: 'Piutang Usaha', type: 'Asset' },
    { code: '2001', name: 'Utang Usaha', type: 'Liability' },
    { code: '3001', name: 'Modal Saham', type: 'Equity' },
    { code: '4001', name: 'Penjualan Bersih', type: 'Revenue' },
    { code: '4002', name: 'Pendapatan Jasa', type: 'Revenue' },
    { code: '5001', name: 'Harga Pokok Penjualan', type: 'Expense' },
    { code: '6001', name: 'Beban Gaji & Upah', type: 'Expense' },
    { code: '6102', name: 'Beban Listrik & Air', type: 'Expense' },
    { code: '6103', name: 'Beban Telepon & Internet', type: 'Expense' },
    { code: '6107', name: 'Beban Transportasi', type: 'Expense' },
    { code: '6109', name: 'Beban Makan & Minuman', type: 'Expense' },
    { code: '7102', name: 'Beban Lain-lain', type: 'Expense' },
  ]

  const accountMap = new Map<string, string>() // code -> id

  for (const acc of requiredAccounts) {
    let existing = await prisma.chartOfAccount.findFirst({
      where: { organizationId: org.id, code: acc.code },
    })

    if (!existing) {
      existing = await prisma.chartOfAccount.create({
        data: { organizationId: org.id, code: acc.code, name: acc.name, type: acc.type },
      })
      console.log(`   ✅ Akun dibuat: ${acc.code} - ${acc.name}`)
    } else {
      console.log(`   ℹ️  Akun sudah ada: ${acc.code} - ${acc.name}`)
    }

    accountMap.set(acc.code, existing.id)
  }

  // --- 2. SEED 10+ TRANSAKSI AKUNTANSI ---
  const existingTransactionCount = await prisma.transaction.count({
    where: { organizationId: org.id },
  })

  if (existingTransactionCount >= 10) {
    console.log(`   ℹ️  Sudah ada ${existingTransactionCount} transaksi. Melewati pembuatan transaksi dummy.`)
  } else {
    console.log('   📝 Membuat 10 transaksi dummy...')

    const transactionsData = [
      {
        description: 'Modal awal pemegang saham',
        reference: 'INV-001',
        date: new Date('2024-01-05'),
        lines: [
          { code: '1002', debit: 50000000, credit: 0 },
          { code: '3001', debit: 0, credit: 50000000 },
        ],
      },
      {
        description: 'Pembelian perlengkapan kantor',
        reference: 'INV-002',
        date: new Date('2024-01-10'),
        lines: [
          { code: '7102', debit: 3500000, credit: 0 },
          { code: '1002', debit: 0, credit: 3500000 },
        ],
      },
      {
        description: 'Penjualan jasa konsultasi - Klien A',
        reference: 'INV-003',
        date: new Date('2024-01-15'),
        lines: [
          { code: '1101', debit: 12500000, credit: 0 },
          { code: '4002', debit: 0, credit: 12500000 },
        ],
      },
      {
        description: 'Pembayaran listrik Januari',
        reference: 'INV-004',
        date: new Date('2024-01-20'),
        lines: [
          { code: '6102', debit: 2800000, credit: 0 },
          { code: '1002', debit: 0, credit: 2800000 },
        ],
      },
      {
        description: 'Pembayaran gaji karyawan Januari',
        reference: 'INV-005',
        date: new Date('2024-01-25'),
        lines: [
          { code: '6001', debit: 25000000, credit: 0 },
          { code: '1002', debit: 0, credit: 25000000 },
        ],
      },
      {
        description: 'Penjualan produk - Tunai',
        reference: 'INV-006',
        date: new Date('2024-02-05'),
        lines: [
          { code: '1001', debit: 8700000, credit: 0 },
          { code: '4001', debit: 0, credit: 8700000 },
        ],
      },
      {
        description: 'Pembelian bahan baku',
        reference: 'INV-007',
        date: new Date('2024-02-12'),
        lines: [
          { code: '5001', debit: 15000000, credit: 0 },
          { code: '1002', debit: 0, credit: 15000000 },
        ],
      },
      {
        description: 'Pembayaran internet & telepon',
        reference: 'INV-008',
        date: new Date('2024-02-18'),
        lines: [
          { code: '6103', debit: 1500000, credit: 0 },
          { code: '1002', debit: 0, credit: 1500000 },
        ],
      },
      {
        description: 'Pembayaran transportasi operasional',
        reference: 'INV-009',
        date: new Date('2024-02-22'),
        lines: [
          { code: '6107', debit: 3200000, credit: 0 },
          { code: '1001', debit: 0, credit: 3200000 },
        ],
      },
      {
        description: 'Pelunasan piutang dari Klien A',
        reference: 'INV-010',
        date: new Date('2024-02-28'),
        lines: [
          { code: '1002', debit: 12500000, credit: 0 },
          { code: '1101', debit: 0, credit: 12500000 },
        ],
      },
      {
        description: 'Beban makan rapat koordinasi',
        reference: 'INV-011',
        date: new Date('2024-03-05'),
        lines: [
          { code: '6109', debit: 1200000, credit: 0 },
          { code: '1001', debit: 0, credit: 1200000 },
        ],
      },
      {
        description: 'Penjualan jasa - Klien B',
        reference: 'INV-012',
        date: new Date('2024-03-10'),
        lines: [
          { code: '1101', debit: 18500000, credit: 0 },
          { code: '4002', debit: 0, credit: 18500000 },
        ],
      },
    ]

    for (const tx of transactionsData) {
      const totalDebit = tx.lines.reduce((sum, l) => sum + l.debit, 0)
      const totalCredit = tx.lines.reduce((sum, l) => sum + l.credit, 0)

      if (totalDebit !== totalCredit) {
        console.warn(`   ⚠️  Transaksi tidak balance: ${tx.reference} (debit: ${totalDebit}, credit: ${totalCredit})`)
        continue
      }

      await prisma.transaction.create({
        data: {
          organizationId: org.id,
          date: tx.date,
          description: tx.description,
          reference: tx.reference,
          lines: {
            create: tx.lines.map((line) => ({
              accountId: accountMap.get(line.code)!,
              debit: line.debit,
              credit: line.credit,
              description: tx.description,
            })),
          },
        },
      })
      console.log(`   ✅ Transaksi: ${tx.reference} - ${tx.description}`)
    }
  }

  // --- 3. SEED 5+ KARYAWAN DENGAN DATA PAYROLL ---
  const existingEmployeeCount = await prisma.employee.count({
    where: { organizationId: org.id },
  })

  if (existingEmployeeCount >= 5) {
    console.log(`   ℹ️  Sudah ada ${existingEmployeeCount} karyawan. Melewati pembuatan karyawan dummy.`)
  } else {
    console.log('   👥 Membuat 5 karyawan dummy...')

    const employeesData = [
      {
        name: 'Ahmad Fauzi',
        nik: 'NIK-001',
        employeeNumber: 'EMP-2024-001',
        email: 'ahmad.fauzi@tiustech.com',
        phone: '081234567890',
        identityNumber: '3175010101990001',
        identityType: 'KTP',
        taxFileNumber: '09.123.456.7-123.000',
        bankAccount: '8800123456789',
        bankName: 'BCA',
        position: 'Software Engineer',
        department: 'Engineering',
        joinDate: new Date('2024-01-15'),
        baseSalary: 15000000,
        taxStatus: 'TK',
        bpjsKesehatanNumber: '00012345678',
        bpjsKetenagakerjaan: '00098765432',
        status: 'ACTIVE',
        allowances: [
          { name: 'Tunjangan Transport', amount: 1500000, effectiveDate: new Date('2024-01-01'), isTaxable: true },
          { name: 'Tunjangan Makan', amount: 1000000, effectiveDate: new Date('2024-01-01'), isTaxable: true },
        ],
        deductions: [
          { name: 'Pinjaman Karyawan', amount: 500000, effectiveDate: new Date('2024-02-01') },
        ],
      },
      {
        name: 'Budi Santoso',
        nik: 'NIK-002',
        employeeNumber: 'EMP-2024-002',
        email: 'budi.santoso@tiustech.com',
        phone: '081298765432',
        identityNumber: '3175010202880002',
        identityType: 'KTP',
        taxFileNumber: '09.234.567.8-234.000',
        bankAccount: '8800234567890',
        bankName: 'Mandiri',
        position: 'Product Manager',
        department: 'Product',
        joinDate: new Date('2024-02-01'),
        baseSalary: 20000000,
        taxStatus: 'K1',
        bpjsKesehatanNumber: '00023456789',
        bpjsKetenagakerjaan: '00087654321',
        status: 'ACTIVE',
        allowances: [
          { name: 'Tunjangan Transport', amount: 2000000, effectiveDate: new Date('2024-02-01'), isTaxable: true },
          { name: 'Tunjangan Komunikasi', amount: 500000, effectiveDate: new Date('2024-02-01'), isTaxable: true },
        ],
        deductions: [],
      },
      {
        name: 'Citra Lestari',
        nik: 'NIK-003',
        employeeNumber: 'EMP-2024-003',
        email: 'citra.lestari@tiustech.com',
        phone: '081312345678',
        identityNumber: '3175010303970003',
        identityType: 'KTP',
        taxFileNumber: '09.345.678.9-345.000',
        bankAccount: '8800345678901',
        bankName: 'BNI',
        position: 'UI/UX Designer',
        department: 'Design',
        joinDate: new Date('2024-01-20'),
        baseSalary: 12000000,
        taxStatus: 'TK',
        bpjsKesehatanNumber: '00034567890',
        bpjsKetenagakerjaan: '00076543210',
        status: 'ACTIVE',
        allowances: [
          { name: 'Tunjangan Transport', amount: 1000000, effectiveDate: new Date('2024-01-20'), isTaxable: true },
          { name: 'Tunjangan Makan', amount: 800000, effectiveDate: new Date('2024-01-20'), isTaxable: true },
          { name: 'Tunjangan Kesehatan', amount: 500000, effectiveDate: new Date('2024-01-20'), isTaxable: false },
        ],
        deductions: [
          { name: 'Cicilan Laptop', amount: 750000, effectiveDate: new Date('2024-02-01') },
        ],
      },
      {
        name: 'Dedi Pratama',
        nik: 'NIK-004',
        employeeNumber: 'EMP-2024-004',
        email: 'dedi.pratama@tiustech.com',
        phone: '081345678901',
        identityNumber: '3175010404860004',
        identityType: 'KTP',
        taxFileNumber: '09.456.789.0-456.000',
        bankAccount: '8800456789012',
        bankName: 'BRI',
        position: 'DevOps Engineer',
        department: 'Engineering',
        joinDate: new Date('2024-03-01'),
        baseSalary: 18000000,
        taxStatus: 'K2',
        bpjsKesehatanNumber: '00045678901',
        bpjsKetenagakerjaan: '00065432109',
        status: 'ACTIVE',
        allowances: [
          { name: 'Tunjangan Transport', amount: 1800000, effectiveDate: new Date('2024-03-01'), isTaxable: true },
          { name: 'Tunjangan Internet', amount: 500000, effectiveDate: new Date('2024-03-01'), isTaxable: true },
        ],
        deductions: [
          { name: 'Denda Keterlambatan', amount: 200000, effectiveDate: new Date('2024-04-01') },
        ],
      },
      {
        name: 'Eka Wulandari',
        nik: 'NIK-005',
        employeeNumber: 'EMP-2024-005',
        email: 'eka.wulandari@tiustech.com',
        phone: '081356789012',
        identityNumber: '3175010505950005',
        identityType: 'KTP',
        taxFileNumber: '09.567.890.1-567.000',
        bankAccount: '8800567890123',
        bankName: 'BCA',
        position: 'Finance Manager',
        department: 'Finance',
        joinDate: new Date('2024-01-01'),
        baseSalary: 22000000,
        taxStatus: 'K1',
        bpjsKesehatanNumber: '00056789012',
        bpjsKetenagakerjaan: '00054321098',
        status: 'ACTIVE',
        allowances: [
          { name: 'Tunjangan Transport', amount: 2000000, effectiveDate: new Date('2024-01-01'), isTaxable: true },
          { name: 'Tunjangan Makan', amount: 1200000, effectiveDate: new Date('2024-01-01'), isTaxable: true },
          { name: 'Tunjangan Pendidikan', amount: 1000000, effectiveDate: new Date('2024-01-01'), isTaxable: true },
        ],
        deductions: [
          { name: 'Pinjaman Karyawan', amount: 1000000, effectiveDate: new Date('2024-01-01') },
          { name: 'Iuran Koperasi', amount: 250000, effectiveDate: new Date('2024-01-01') },
        ],
      },
    ]

    for (const empData of employeesData) {
      const { allowances, deductions, ...employeeCore } = empData

      const employee = await prisma.employee.create({
        data: {
          organizationId: org.id,
          ...employeeCore,
        },
      })

      // Create allowances
      for (const allowance of allowances) {
        await prisma.allowance.create({
          data: {
            employeeId: employee.id,
            ...allowance,
          },
        })
      }

      // Create deductions
      for (const deduction of deductions) {
        await prisma.deduction.create({
          data: {
            employeeId: employee.id,
            ...deduction,
          },
        })
      }

      // Create salary slip for January 2024
      const totalAllowance = allowances.reduce((s, a) => s + a.amount, 0)
      const totalDeduction = deductions.reduce((s, d) => s + d.amount, 0)
      const grossIncome = employeeCore.baseSalary + totalAllowance
      const bpjsKesehatanEmployee = Math.round(employeeCore.baseSalary * 0.04)
      const bpjsKetenagakerjaan = Math.round(employeeCore.baseSalary * 0.02)
      const netIncome = grossIncome - totalDeduction - bpjsKesehatanEmployee - bpjsKetenagakerjaan

      await prisma.salarySlip.create({
        data: {
          organizationId: org.id,
          employeeId: employee.id,
          month: 1,
          year: 2024,
          baseSalary: employeeCore.baseSalary,
          totalAllowance,
          totalDeduction,
          bpjsKesehatanEmployee,
          bpjsKetenagakerjaan,
          pph21: Math.round(netIncome * 0.05),
          grossIncome,
          netIncome: Math.round(netIncome * 0.95),
          status: 'PAID',
          paymentDate: new Date('2024-01-25'),
        },
      })

      // Create salary slip for February 2024
      await prisma.salarySlip.create({
        data: {
          organizationId: org.id,
          employeeId: employee.id,
          month: 2,
          year: 2024,
          baseSalary: employeeCore.baseSalary,
          totalAllowance,
          totalDeduction,
          bpjsKesehatanEmployee,
          bpjsKetenagakerjaan,
          pph21: Math.round(netIncome * 0.05),
          grossIncome,
          netIncome: Math.round(netIncome * 0.95),
          status: 'FINALIZED',
          paymentDate: new Date('2024-02-25'),
        },
      })

      console.log(`   ✅ Karyawan: ${employeeCore.name} (${employeeCore.position}) - 2 slip gaji dibuat`)
    }
  }

  // --- 4. SUMMARY ---
  const finalTxCount = await prisma.transaction.count({ where: { organizationId: org.id } })
  const finalEmpCount = await prisma.employee.count({ where: { organizationId: org.id } })
  const finalSlipCount = await prisma.salarySlip.count({ where: { organizationId: org.id } })

  console.log('\n📊 Ringkasan Seeding Dummy:')
  console.log(`   - Transaksi: ${finalTxCount}`)
  console.log(`   - Karyawan: ${finalEmpCount}`)
  console.log(`   - Slip Gaji: ${finalSlipCount}`)
  console.log('\n✅ Seeding dummy selesai!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
