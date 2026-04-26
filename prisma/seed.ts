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
  console.log('Memulai proses seeding data akuntansi...')

  // Cek apakah sudah ada organisasi
  const existingOrgs = await prisma.organization.findMany()
  
  if (existingOrgs.length > 0) {
    console.log(`Ditemukan ${existingOrgs.length} organisasi yang sudah ada. Menambahkan COA standar ke organisasi pertama...`)
    
    const org = existingOrgs[0]
    
    // Cek apakah sudah ada akun bank
    const existingBank = await prisma.chartOfAccount.findFirst({
      where: { organizationId: org.id, code: '1002' }
    })
    
    if (!existingBank) {
      const coaBank = await prisma.chartOfAccount.create({
        data: { organizationId: org.id, code: '1002', name: 'Bank', type: 'Asset' }
      })
      
      await prisma.bankAccount.create({
        data: {
          organizationId: org.id,
          accountId: coaBank.id,
          bankName: 'BCA',
          accountNumber: '1234567890',
          accountName: 'Rekening Utama'
        }
      })
    }
    
    // Tambahkan COA Standar Indonesia (PSAK)
    const standardCOA = [
      // 1xxx - ASET LANCAR
      { code: '1001', name: 'Kas Kecil', type: 'Asset' },
      { code: '1101', name: 'Piutang Usaha', type: 'Asset' },
      { code: '1102', name: 'Piutang Lain-lain', type: 'Asset' },
      { code: '1201', name: 'Persediaan Barang Dagang', type: 'Asset' },
      { code: '1202', name: 'Persediaan Bahan Baku', type: 'Asset' },
      { code: '1203', name: 'Persediaan Barang Jadi', type: 'Asset' },
      { code: '1301', name: 'Uang Muka Pembelian', type: 'Asset' },
      { code: '1302', name: 'Biaya Dibayar Dimuka', type: 'Asset' },
      { code: '1401', name: 'Pajak Dibayar Dimuka (PPN)', type: 'Asset' },

      // 15xx - ASET TETAP
      { code: '1501', name: 'Tanah', type: 'Asset' },
      { code: '1502', name: 'Bangunan', type: 'Asset' },
      { code: '1503', name: 'Kendaraan', type: 'Asset' },
      { code: '1504', name: 'Peralatan & Mesin', type: 'Asset' },
      { code: '1505', name: 'Perabot Kantor', type: 'Asset' },
      { code: '1506', name: 'Komputer & Peralatan IT', type: 'Asset' },
      { code: '1510', name: 'Akumulasi Penyusutan Bangunan', type: 'Asset' },
      { code: '1511', name: 'Akumulasi Penyusutan Kendaraan', type: 'Asset' },
      { code: '1512', name: 'Akumulasi Penyusutan Peralatan', type: 'Asset' },

      // 2xxx - KEWAJIBAN LANCAR
      { code: '2001', name: 'Utang Usaha', type: 'Liability' },
      { code: '2002', name: 'Utang Gaji & Upah', type: 'Liability' },
      { code: '2003', name: 'Utang Pajak', type: 'Liability' },
      { code: '2004', name: 'Utang PPh 21', type: 'Liability' },
      { code: '2005', name: 'Utang PPh 23', type: 'Liability' },
      { code: '2006', name: 'Utang PPN', type: 'Liability' },
      { code: '2101', name: 'Uang Muka Pelanggan', type: 'Liability' },
      { code: '2102', name: 'Pendapatan Diterima Dimuka', type: 'Liability' },

      // 25xx - KEWAJIBAN JANGKA PANJANG
      { code: '2501', name: 'Pinjaman Bank', type: 'Liability' },
      { code: '2502', name: 'Utang Obligasi', type: 'Liability' },
      { code: '2503', name: 'Utang Sewa', type: 'Liability' },

      // 3xxx - EKUITAS / MODAL
      { code: '3001', name: 'Modal Saham', type: 'Equity' },
      { code: '3002', name: 'Tambahan Modal Disetor', type: 'Equity' },
      { code: '3101', name: 'Saldo Laba', type: 'Equity' },
      { code: '3102', name: 'Laba Tahun Berjalan', type: 'Equity' },
      { code: '3201', name: 'Cadangan Umum', type: 'Equity' },
      { code: '3202', name: 'Cadangan Revaluasi Aset', type: 'Equity' },

      // 4xxx - PENDAPATAN
      { code: '4001', name: 'Penjualan Bersih', type: 'Revenue' },
      { code: '4002', name: 'Pendapatan Jasa', type: 'Revenue' },
      { code: '4003', name: 'Pendapatan Sewa', type: 'Revenue' },
      { code: '4004', name: 'Pendapatan Royalti', type: 'Revenue' },
      { code: '4101', name: 'Diskon Penjualan', type: 'Revenue' },
      { code: '4102', name: 'Retur Penjualan', type: 'Revenue' },

      // 5xxx - HARGA POKOK PENJUALAN
      { code: '5001', name: 'Harga Pokok Penjualan', type: 'Expense' },
      { code: '5002', name: 'Beban Bahan Baku', type: 'Expense' },
      { code: '5003', name: 'Beban Tenaga Kerja Langsung', type: 'Expense' },
      { code: '5004', name: 'Beban Overhead Pabrik', type: 'Expense' },

      // 6xxx - BEBAN OPERASIONAL
      { code: '6001', name: 'Beban Gaji & Upah', type: 'Expense' },
      { code: '6002', name: 'Beban Tunjangan', type: 'Expense' },
      { code: '6003', name: 'Beban Lembur', type: 'Expense' },
      { code: '6004', name: 'Beban BPJS Ketenagakerjaan', type: 'Expense' },
      { code: '6005', name: 'Beban BPJS Kesehatan', type: 'Expense' },
      { code: '6006', name: 'Beban PPh 21', type: 'Expense' },
      { code: '6101', name: 'Beban Sewa', type: 'Expense' },
      { code: '6102', name: 'Beban Listrik & Air', type: 'Expense' },
      { code: '6103', name: 'Beban Telepon & Internet', type: 'Expense' },
      { code: '6104', name: 'Beban Perawatan & Pemeliharaan', type: 'Expense' },
      { code: '6105', name: 'Beban Asuransi', type: 'Expense' },
      { code: '6106', name: 'Beban Iklan & Promosi', type: 'Expense' },
      { code: '6107', name: 'Beban Transportasi', type: 'Expense' },
      { code: '6108', name: 'Beban Perjalanan Dinas', type: 'Expense' },
      { code: '6109', name: 'Beban Makan & Minuman', type: 'Expense' },
      { code: '6110', name: 'Beban Kantor', type: 'Expense' },
      { code: '6111', name: 'Beban Perlengkapan', type: 'Expense' },
      { code: '6112', name: 'Beban Penyusutan', type: 'Expense' },
      { code: '6113', name: 'Beban Amortisasi', type: 'Expense' },
      { code: '6114', name: 'Beban Kerugian Piutang', type: 'Expense' },
      { code: '6201', name: 'Beban Bunga Bank', type: 'Expense' },
      { code: '6202', name: 'Beban Pajak Penghasilan', type: 'Expense' },

      // 7xxx - PENDAPATAN & BEBAN LAIN-LAIN
      { code: '7001', name: 'Pendapatan Bunga Bank', type: 'Revenue' },
      { code: '7002', name: 'Pendapatan Sewa Aset', type: 'Revenue' },
      { code: '7003', name: 'Pendapatan Kurs Valas', type: 'Revenue' },
      { code: '7004', name: 'Pendapatan Lain-lain', type: 'Revenue' },
      { code: '7101', name: 'Beban Kurs Valas', type: 'Expense' },
      { code: '7102', name: 'Beban Lain-lain', type: 'Expense' },
      { code: '7103', name: 'Beban Kerugian Penjualan Aset', type: 'Expense' },
    ]

    // Hanya tambahkan akun yang belum ada
    for (const coa of standardCOA) {
      const existing = await prisma.chartOfAccount.findFirst({
        where: { organizationId: org.id, code: coa.code }
      })
      if (!existing) {
        await prisma.chartOfAccount.create({
          data: { ...coa, organizationId: org.id }
        })
      }
    }

    console.log(`✅ Seeding selesai! COA standar ditambahkan ke organisasi: ${org.name}`)
    return
  }

  // --- 1. SEEDING YAYASAN ---
  const yayasan = await prisma.organization.create({
    data: { name: 'Yayasan Peduli Umat', type: 'YAYASAN' },
  })

  // Akun Bank untuk Yayasan
  const coaBankYayasan = await prisma.chartOfAccount.create({
    data: { organizationId: yayasan.id, code: '1002', name: 'Bank Syariah (BSI)', type: 'Asset' }
  })

  await prisma.bankAccount.create({
    data: {
      organizationId: yayasan.id,
      accountId: coaBankYayasan.id,
      bankName: 'BSI',
      accountNumber: '7112233445',
      accountName: 'Bendahara Yayasan'
    }
  })

  // Tambahkan COA Standar untuk Yayasan (sederhana)
  await prisma.chartOfAccount.createMany({
    data: [
      { organizationId: yayasan.id, code: '1001', name: 'Kas Kecil', type: 'Asset' },
      { organizationId: yayasan.id, code: '1101', name: 'Piutang Donatur', type: 'Asset' },
      { organizationId: yayasan.id, code: '2001', name: 'Utang Usaha', type: 'Liability' },
      { organizationId: yayasan.id, code: '3001', name: 'Modal Yayasan', type: 'Equity' },
      { organizationId: yayasan.id, code: '3101', name: 'Saldo Laba', type: 'Equity' },
      { organizationId: yayasan.id, code: '4001', name: 'Pendapatan Donasi', type: 'Revenue' },
      { organizationId: yayasan.id, code: '4002', name: 'Pendapatan Program', type: 'Revenue' },
      { organizationId: yayasan.id, code: '5001', name: 'Beban Program', type: 'Expense' },
      { organizationId: yayasan.id, code: '5002', name: 'Beban Operasional', type: 'Expense' },
      { organizationId: yayasan.id, code: '5003', name: 'Beban Gaji', type: 'Expense' },
    ]
  })

  // --- 2. SEEDING PERUSAHAAN PERORANGAN (PT) ---
  const pt = await prisma.organization.create({
    data: { name: 'PT Tius Tech Digital', type: 'PERUSAHAAN' },
  })

  // Akun Bank untuk PT
  const coaBankPT = await prisma.chartOfAccount.create({
    data: { organizationId: pt.id, code: '1002', name: 'Bank BCA Business', type: 'Asset' }
  })

  await prisma.bankAccount.create({
    data: {
      organizationId: pt.id,
      accountId: coaBankPT.id,
      bankName: 'BCA',
      accountNumber: '8800991122',
      accountName: 'Tius - PT Tech'
    }
  })

  // Tambahkan COA Lengkap Standar Indonesia (PSAK) untuk PT
  const standardCOA = [
    // 1xxx - ASET LANCAR
    { code: '1001', name: 'Kas Kecil', type: 'Asset' },
    { code: '1002', name: 'Bank', type: 'Asset' },
    { code: '1101', name: 'Piutang Usaha', type: 'Asset' },
    { code: '1102', name: 'Piutang Lain-lain', type: 'Asset' },
    { code: '1201', name: 'Persediaan Barang Dagang', type: 'Asset' },
    { code: '1202', name: 'Persediaan Bahan Baku', type: 'Asset' },
    { code: '1203', name: 'Persediaan Barang Jadi', type: 'Asset' },
    { code: '1301', name: 'Uang Muka Pembelian', type: 'Asset' },
    { code: '1302', name: 'Biaya Dibayar Dimuka', type: 'Asset' },
    { code: '1401', name: 'Pajak Dibayar Dimuka (PPN)', type: 'Asset' },

    // 15xx - ASET TETAP
    { code: '1501', name: 'Tanah', type: 'Asset' },
    { code: '1502', name: 'Bangunan', type: 'Asset' },
    { code: '1503', name: 'Kendaraan', type: 'Asset' },
    { code: '1504', name: 'Peralatan & Mesin', type: 'Asset' },
    { code: '1505', name: 'Perabot Kantor', type: 'Asset' },
    { code: '1506', name: 'Komputer & Peralatan IT', type: 'Asset' },
    { code: '1510', name: 'Akumulasi Penyusutan Bangunan', type: 'Asset' },
    { code: '1511', name: 'Akumulasi Penyusutan Kendaraan', type: 'Asset' },
    { code: '1512', name: 'Akumulasi Penyusutan Peralatan', type: 'Asset' },

    // 2xxx - KEWAJIBAN LANCAR
    { code: '2001', name: 'Utang Usaha', type: 'Liability' },
    { code: '2002', name: 'Utang Gaji & Upah', type: 'Liability' },
    { code: '2003', name: 'Utang Pajak', type: 'Liability' },
    { code: '2004', name: 'Utang PPh 21', type: 'Liability' },
    { code: '2005', name: 'Utang PPh 23', type: 'Liability' },
    { code: '2006', name: 'Utang PPN', type: 'Liability' },
    { code: '2101', name: 'Uang Muka Pelanggan', type: 'Liability' },
    { code: '2102', name: 'Pendapatan Diterima Dimuka', type: 'Liability' },

    // 25xx - KEWAJIBAN JANGKA PANJANG
    { code: '2501', name: 'Pinjaman Bank', type: 'Liability' },
    { code: '2502', name: 'Utang Obligasi', type: 'Liability' },
    { code: '2503', name: 'Utang Sewa', type: 'Liability' },

    // 3xxx - EKUITAS / MODAL
    { code: '3001', name: 'Modal Saham', type: 'Equity' },
    { code: '3002', name: 'Tambahan Modal Disetor', type: 'Equity' },
    { code: '3101', name: 'Saldo Laba', type: 'Equity' },
    { code: '3102', name: 'Laba Tahun Berjalan', type: 'Equity' },
    { code: '3201', name: 'Cadangan Umum', type: 'Equity' },
    { code: '3202', name: 'Cadangan Revaluasi Aset', type: 'Equity' },

    // 4xxx - PENDAPATAN
    { code: '4001', name: 'Penjualan Bersih', type: 'Revenue' },
    { code: '4002', name: 'Pendapatan Jasa', type: 'Revenue' },
    { code: '4003', name: 'Pendapatan Sewa', type: 'Revenue' },
    { code: '4004', name: 'Pendapatan Royalti', type: 'Revenue' },
    { code: '4101', name: 'Diskon Penjualan', type: 'Revenue' },
    { code: '4102', name: 'Retur Penjualan', type: 'Revenue' },

    // 5xxx - HARGA POKOK PENJUALAN
    { code: '5001', name: 'Harga Pokok Penjualan', type: 'Expense' },
    { code: '5002', name: 'Beban Bahan Baku', type: 'Expense' },
    { code: '5003', name: 'Beban Tenaga Kerja Langsung', type: 'Expense' },
    { code: '5004', name: 'Beban Overhead Pabrik', type: 'Expense' },

    // 6xxx - BEBAN OPERASIONAL
    { code: '6001', name: 'Beban Gaji & Upah', type: 'Expense' },
    { code: '6002', name: 'Beban Tunjangan', type: 'Expense' },
    { code: '6003', name: 'Beban Lembur', type: 'Expense' },
    { code: '6004', name: 'Beban BPJS Ketenagakerjaan', type: 'Expense' },
    { code: '6005', name: 'Beban BPJS Kesehatan', type: 'Expense' },
    { code: '6006', name: 'Beban PPh 21', type: 'Expense' },
    { code: '6101', name: 'Beban Sewa', type: 'Expense' },
    { code: '6102', name: 'Beban Listrik & Air', type: 'Expense' },
    { code: '6103', name: 'Beban Telepon & Internet', type: 'Expense' },
    { code: '6104', name: 'Beban Perawatan & Pemeliharaan', type: 'Expense' },
    { code: '6105', name: 'Beban Asuransi', type: 'Expense' },
    { code: '6106', name: 'Beban Iklan & Promosi', type: 'Expense' },
    { code: '6107', name: 'Beban Transportasi', type: 'Expense' },
    { code: '6108', name: 'Beban Perjalanan Dinas', type: 'Expense' },
    { code: '6109', name: 'Beban Makan & Minuman', type: 'Expense' },
    { code: '6110', name: 'Beban Kantor', type: 'Expense' },
    { code: '6111', name: 'Beban Perlengkapan', type: 'Expense' },
    { code: '6112', name: 'Beban Penyusutan', type: 'Expense' },
    { code: '6113', name: 'Beban Amortisasi', type: 'Expense' },
    { code: '6114', name: 'Beban Kerugian Piutang', type: 'Expense' },
    { code: '6201', name: 'Beban Bunga Bank', type: 'Expense' },
    { code: '6202', name: 'Beban Pajak Penghasilan', type: 'Expense' },

    // 7xxx - PENDAPATAN & BEBAN LAIN-LAIN
    { code: '7001', name: 'Pendapatan Bunga Bank', type: 'Revenue' },
    { code: '7002', name: 'Pendapatan Sewa Aset', type: 'Revenue' },
    { code: '7003', name: 'Pendapatan Kurs Valas', type: 'Revenue' },
    { code: '7004', name: 'Pendapatan Lain-lain', type: 'Revenue' },
    { code: '7101', name: 'Beban Kurs Valas', type: 'Expense' },
    { code: '7102', name: 'Beban Lain-lain', type: 'Expense' },
    { code: '7103', name: 'Beban Kerugian Penjualan Aset', type: 'Expense' },
  ]

  await prisma.chartOfAccount.createMany({
    data: standardCOA.map(coa => ({ ...coa, organizationId: pt.id }))
  })

  console.log('✅ Seeding selesai! Yayasan & PT berhasil dibuat dengan Rekening Bank.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })