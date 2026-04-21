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

  // Tambahkan COA Modal & Pendapatan standar untuk PT
  await prisma.chartOfAccount.createMany({
    data: [
      { organizationId: pt.id, code: '3000', name: 'Modal Disetor', type: 'Equity' },
      { organizationId: pt.id, code: '4000', name: 'Pendapatan Jasa SaaS', type: 'Revenue' },
      { organizationId: pt.id, code: '5000', name: 'Beban Server & API', type: 'Expense' },
    ]
  })

  console.log('✅ Seeding selesai! Yayasan & PT berhasil dibuat dengan Rekening Bank.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })