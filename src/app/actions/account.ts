"use server"

import { prisma } from "../../lib/prisma"
import { revalidatePath } from "next/cache"
import { requireCurrentOrganization } from "../../lib/auth"
import { hasModulePermission } from "../../lib/permissions"

// CREATE ACCOUNT
export async function createChartOfAccount(formData: FormData) {
  const { user, organization } = await requireCurrentOrganization()

  // Permission check: hanya ADMIN, MANAGER yang bisa membuat akun
  if (!hasModulePermission(user, "accounts")) {
    throw new Error("Anda tidak memiliki izin untuk membuat akun.")
  }

  const orgId = organization.id
  const code = formData.get("code") as string
  const name = formData.get("name") as string
  const type = formData.get("type") as string
  const categoryId = formData.get("categoryId") as string

  if (!code || !name || !type) {
    throw new Error("Data akun tidak lengkap")
  }

  await prisma.chartOfAccount.create({
    data: {
      organizationId: orgId,
      code,
      name,
      type,
      categoryId: categoryId || null
    }
  })

  revalidatePath("/akun")
  revalidatePath("/transaksi")
}

// UPDATE ACCOUNT
export async function updateChartOfAccount(formData: FormData) {
  const { user } = await requireCurrentOrganization()

  // Permission check: hanya ADMIN, MANAGER yang bisa edit akun
  if (!hasModulePermission(user, "accounts")) {
    throw new Error("Anda tidak memiliki izin untuk mengubah akun.")
  }

  const id = formData.get("id") as string
  const code = formData.get("code") as string
  const name = formData.get("name") as string
  const type = formData.get("type") as string
  const categoryId = formData.get("categoryId") as string

  if (!id || !code || !name || !type) {
    throw new Error("Data akun tidak lengkap")
  }

  await prisma.chartOfAccount.update({
    where: { id },
    data: {
      code,
      name,
      type,
      categoryId: categoryId || null
    }
  })

  revalidatePath("/akun")
  revalidatePath("/transaksi")
}

// DELETE ACCOUNT
export async function deleteChartOfAccount(id: string) {
  try {
    const { user } = await requireCurrentOrganization()

    // Permission check: hanya ADMIN yang bisa hapus akun
    if (user.role !== "ADMIN") {
      throw new Error("Anda tidak memiliki izin untuk menghapus akun. Hanya admin yang dapat menghapus.")
    }

    // Check if account has transactions
    const transactionCount = await prisma.transactionLine.count({
      where: { accountId: id }
    })

    if (transactionCount > 0) {
      throw new Error("Tidak dapat menghapus akun yang memiliki transaksi")
    }

    // Check if account is linked to bank account
    const bankAccount = await prisma.bankAccount.findUnique({
      where: { accountId: id }
    })

    if (bankAccount) {
      throw new Error("Tidak dapat menghapus akun yang terhubung dengan rekening bank")
    }

    const investment = await prisma.investment.findUnique({
      where: { accountId: id }
    })

    if (investment) {
      throw new Error("Tidak dapat menghapus akun yang terhubung dengan investasi")
    }

    await prisma.chartOfAccount.delete({
      where: { id }
    })

    revalidatePath("/akun")
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menghapus akun" }
  }
}

// INITIALIZE DEFAULT INDONESIA ACCOUNTS
const DEFAULT_INDONESIA_ACCOUNTS = [
  // ASSET (1000-1999)
  { code: '1000', name: 'Kas', type: 'Asset', category: 'Kas & Bank' },
  { code: '1010', name: 'Kas Kecil', type: 'Asset', category: 'Kas & Bank' },
  { code: '1100', name: 'Bank - Rekening Utama', type: 'Asset', category: 'Kas & Bank' },
  { code: '1110', name: 'Bank - Rekening Investasi', type: 'Asset', category: 'Kas & Bank' },
  { code: '1200', name: 'Investasi Jangka Pendek', type: 'Asset', category: 'Investasi' },
  { code: '1300', name: 'Piutang Usaha', type: 'Asset', category: 'Piutang' },
  { code: '1310', name: 'Piutang - Pelanggan A', type: 'Asset', category: 'Piutang' },
  { code: '1320', name: 'Piutang - Pelanggan B', type: 'Asset', category: 'Piutang' },
  { code: '1400', name: 'Penyisihan Piutang Ragu-ragu', type: 'Asset', category: 'Piutang' },
  { code: '1410', name: 'PPN Masukan', type: 'Asset', category: 'Aset Lancar Lain' },
  { code: '1420', name: 'Pajak Dibayar Dimuka', type: 'Asset', category: 'Aset Lancar Lain' },
  { code: '1500', name: 'Persediaan Barang Dagang', type: 'Asset', category: 'Persediaan' },
  { code: '1510', name: 'Persediaan Bahan Baku', type: 'Asset', category: 'Persediaan' },
  { code: '1520', name: 'Persediaan Barang Setengah Jadi', type: 'Asset', category: 'Persediaan' },
  { code: '1600', name: 'Biaya Dibayar di Muka', type: 'Asset', category: 'Aset Lancar Lain' },
  
  // FIXED ASSETS (1700-1900)
  { code: '1700', name: 'Tanah', type: 'Asset', category: 'Aset Tetap' },
  { code: '1710', name: 'Bangunan', type: 'Asset', category: 'Aset Tetap' },
  { code: '1711', name: 'Akumulasi Penyusutan Bangunan', type: 'Asset', category: 'Aset Tetap' },
  { code: '1720', name: 'Kendaraan', type: 'Asset', category: 'Aset Tetap' },
  { code: '1721', name: 'Akumulasi Penyusutan Kendaraan', type: 'Asset', category: 'Aset Tetap' },
  { code: '1730', name: 'Mesin & Peralatan', type: 'Asset', category: 'Aset Tetap' },
  { code: '1731', name: 'Akumulasi Penyusutan Mesin', type: 'Asset', category: 'Aset Tetap' },
  { code: '1740', name: 'Furniture & Peralatan Kantor', type: 'Asset', category: 'Aset Tetap' },
  { code: '1741', name: 'Akumulasi Penyusutan Furniture', type: 'Asset', category: 'Aset Tetap' },
  { code: '1750', name: 'Aset Tetap Lainnya', type: 'Asset', category: 'Aset Tetap' },
  { code: '1751', name: 'Akumulasi Penyusutan Aset Lainnya', type: 'Asset', category: 'Aset Tetap' },
  { code: '1760', name: 'Aset Tak Berwujud', type: 'Asset', category: 'Aset Tak Berwujud' },
  { code: '1761', name: 'Akumulasi Amortisasi Aset Tak Berwujud', type: 'Asset', category: 'Aset Tak Berwujud' },

  // LIABILITY (2000-2999)
  { code: '2000', name: 'Hutang Usaha', type: 'Liability', category: 'Hutang' },
  { code: '2010', name: 'Hutang - Supplier A', type: 'Liability', category: 'Hutang' },
  { code: '2020', name: 'Hutang - Supplier B', type: 'Liability', category: 'Hutang' },
  { code: '2100', name: 'Hutang Pajak', type: 'Liability', category: 'Hutang Pajak' },
  { code: '2110', name: 'Hutang PPh 21', type: 'Liability', category: 'Hutang Pajak' },
  { code: '2120', name: 'Hutang PPh 23', type: 'Liability', category: 'Hutang Pajak' },
  { code: '2130', name: 'Hutang PPN', type: 'Liability', category: 'Hutang Pajak' },
  { code: '2200', name: 'Hutang Gaji & Tunjangan', type: 'Liability', category: 'Hutang Karyawan' },
  { code: '2210', name: 'Hutang BPJS Kesehatan', type: 'Liability', category: 'Hutang Karyawan' },
  { code: '2220', name: 'Hutang BPJS Ketenagakerjaan', type: 'Liability', category: 'Hutang Karyawan' },
  { code: '2230', name: 'Hutang Kontribusi THR', type: 'Liability', category: 'Hutang Karyawan' },
  { code: '2300', name: 'Hutang Bank Jangka Panjang', type: 'Liability', category: 'Hutang Jangka Panjang' },
  { code: '2400', name: 'Hutang Pihak Terkait', type: 'Liability', category: 'Hutang Lain' },

  // EQUITY (3000-3999)
  { code: '3000', name: 'Modal Saham', type: 'Equity', category: 'Modal' },
  { code: '3100', name: 'Modal Disetor Tambahan', type: 'Equity', category: 'Modal' },
  { code: '3200', name: 'Laba Ditahan', type: 'Equity', category: 'Laba Ditahan' },
  { code: '3210', name: 'Laba Tahun Lalu', type: 'Equity', category: 'Laba Ditahan' },
  { code: '3300', name: 'Dividen', type: 'Equity', category: 'Dividen' },

  // REVENUE (4000-4999)
  { code: '4000', name: 'Penjualan Produk A', type: 'Revenue', category: 'Penjualan' },
  { code: '4010', name: 'Penjualan Produk B', type: 'Revenue', category: 'Penjualan' },
  { code: '4020', name: 'Penjualan Jasa', type: 'Revenue', category: 'Pendapatan' },
  { code: '4030', name: 'Retur Penjualan', type: 'Revenue', category: 'Penjualan' },
  { code: '4040', name: 'Diskon Penjualan', type: 'Revenue', category: 'Penjualan' },
  { code: '4100', name: 'Pendapatan Bunga', type: 'Revenue', category: 'Pendapatan Lain' },
  { code: '4110', name: 'Pendapatan Sewa', type: 'Revenue', category: 'Pendapatan Lain' },
  { code: '4120', name: 'Keuntungan Selisih Kurs', type: 'Revenue', category: 'Pendapatan Lain' },
  { code: '4130', name: 'Pendapatan Lain-lain', type: 'Revenue', category: 'Pendapatan Lain' },

  // EXPENSE (5000-5999)
  { code: '5000', name: 'Harga Pokok Penjualan', type: 'Expense', category: 'COGS' },
  { code: '5010', name: 'Pembelian Bahan Baku', type: 'Expense', category: 'COGS' },
  { code: '5020', name: 'Tenaga Kerja Langsung', type: 'Expense', category: 'COGS' },
  { code: '5030', name: 'Overhead Pabrik', type: 'Expense', category: 'COGS' },
  
  // OPERATING EXPENSES - Gaji & Tunjangan
  { code: '5100', name: 'Gaji Karyawan', type: 'Expense', category: 'Gaji & Tunjangan' },
  { code: '5110', name: 'Tunjangan Kesehatan', type: 'Expense', category: 'Gaji & Tunjangan' },
  { code: '5120', name: 'Tunjangan Makan', type: 'Expense', category: 'Gaji & Tunjangan' },
  { code: '5130', name: 'Tunjangan Transport', type: 'Expense', category: 'Gaji & Tunjangan' },
  { code: '5140', name: 'Tunjangan Lainnya', type: 'Expense', category: 'Gaji & Tunjangan' },
  { code: '5150', name: 'Bonus & Insentif', type: 'Expense', category: 'Gaji & Tunjangan' },

  // OPERATING EXPENSES - Utilitas
  { code: '5200', name: 'Biaya Listrik', type: 'Expense', category: 'Utilitas' },
  { code: '5210', name: 'Biaya Air', type: 'Expense', category: 'Utilitas' },
  { code: '5220', name: 'Biaya Telepon & Internet', type: 'Expense', category: 'Utilitas' },
  { code: '5230', name: 'Biaya Gas', type: 'Expense', category: 'Utilitas' },

  // OPERATING EXPENSES - Perlengkapan & Perawatan
  { code: '5300', name: 'Perlengkapan Kantor', type: 'Expense', category: 'Perawatan' },
  { code: '5310', name: 'Perawatan & Perbaikan Bangunan', type: 'Expense', category: 'Perawatan' },
  { code: '5320', name: 'Perawatan & Perbaikan Kendaraan', type: 'Expense', category: 'Perawatan' },
  { code: '5330', name: 'Perawatan & Perbaikan Mesin', type: 'Expense', category: 'Perawatan' },
  { code: '5340', name: 'Perawatan & Perbaikan Peralatan', type: 'Expense', category: 'Perawatan' },

  // OPERATING EXPENSES - Penjualan & Pemasaran
  { code: '5400', name: 'Iklan & Promosi', type: 'Expense', category: 'Pemasaran' },
  { code: '5410', name: 'Komisi Penjual', type: 'Expense', category: 'Pemasaran' },
  { code: '5420', name: 'Biaya Pengiriman', type: 'Expense', category: 'Pemasaran' },

  // OPERATING EXPENSES - Administrasi
  { code: '5500', name: 'Biaya Audit & Konsultasi', type: 'Expense', category: 'Administrasi' },
  { code: '5510', name: 'Biaya Asuransi', type: 'Expense', category: 'Administrasi' },
  { code: '5520', name: 'Biaya Hukum', type: 'Expense', category: 'Administrasi' },
  { code: '5530', name: 'Biaya Pendaftaran & Lisensi', type: 'Expense', category: 'Administrasi' },
  { code: '5540', name: 'Donasi & Sumbangan', type: 'Expense', category: 'Administrasi' },

  // OTHER EXPENSES
  { code: '5600', name: 'Beban Penyusutan Bangunan', type: 'Expense', category: 'Penyusutan' },
  { code: '5610', name: 'Beban Penyusutan Kendaraan', type: 'Expense', category: 'Penyusutan' },
  { code: '5620', name: 'Beban Penyusutan Mesin', type: 'Expense', category: 'Penyusutan' },
  { code: '5630', name: 'Beban Penyusutan Furniture', type: 'Expense', category: 'Penyusutan' },
  { code: '5640', name: 'Beban Penyusutan Lainnya', type: 'Expense', category: 'Penyusutan' },
  { code: '5650', name: 'Beban Amortisasi Aset Tak Berwujud', type: 'Expense', category: 'Penyusutan' },
  
  { code: '5700', name: 'Beban Pajak Penghasilan', type: 'Expense', category: 'Pajak' },
  { code: '5710', name: 'Beban Pajak Lainnya', type: 'Expense', category: 'Pajak' },
  
  { code: '5800', name: 'Kerugian Selisih Kurs', type: 'Expense', category: 'Beban Lain' },
  { code: '5810', name: 'Beban Lain-lain', type: 'Expense', category: 'Beban Lain' },
]

export async function initializeDefaultAccounts(organizationId: string) {
  try {
    // Get organization
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: { categories: true }
    })

    if (!organization) {
      return { success: false, error: 'Organisasi tidak ditemukan' }
    }

    // Get or create default categories
    const categoryMap: Record<string, string> = {}
    const categoryNames = [
      'Kas & Bank',
      'Investasi',
      'Piutang',
      'Persediaan',
      'Aset Lancar Lain',
      'Aset Tetap',
      'Aset Tak Berwujud',
      'Hutang',
      'Hutang Pajak',
      'Hutang Karyawan',
      'Hutang Jangka Panjang',
      'Hutang Lain',
      'Modal',
      'Laba Ditahan',
      'Dividen',
      'Penjualan',
      'Pendapatan',
      'Pendapatan Lain',
      'COGS',
      'Gaji & Tunjangan',
      'Utilitas',
      'Perawatan',
      'Pemasaran',
      'Administrasi',
      'Penyusutan',
      'Pajak',
      'Beban Lain'
    ]

    // Create categories if not exist
    for (const catName of categoryNames) {
      let category = organization.categories.find(c => c.name === catName)
      if (!category) {
        category = await prisma.accountCategory.create({
          data: {
            organizationId,
            name: catName,
            color: getColorForCategory(catName)
          }
        })
      }
      categoryMap[catName] = category.id
    }

    // Get existing accounts to avoid duplicates
    const existingAccounts = await prisma.chartOfAccount.findMany({
      where: { organizationId },
      select: { code: true }
    })
    const existingCodes = new Set(existingAccounts.map(a => a.code))

    // Create accounts
    let createdCount = 0
    for (const account of DEFAULT_INDONESIA_ACCOUNTS) {
      if (!existingCodes.has(account.code)) {
        await prisma.chartOfAccount.create({
          data: {
            organizationId,
            code: account.code,
            name: account.name,
            type: account.type,
            categoryId: categoryMap[account.category],
            isHeader: false
          }
        })
        createdCount++
      }
    }

    revalidatePath("/akun")
    return { 
      success: true, 
      message: `Berhasil menambah ${createdCount} akun default Indonesia` 
    }
  } catch (error: any) {
    console.error('Initialize accounts error:', error)
    return { success: false, error: 'Gagal menginisialisasi akun default' }
  }
}

function getColorForCategory(category: string): string {
  const colorMap: Record<string, string> = {
    'Kas & Bank': '#3B82F6',
    'Investasi': '#06B6D4',
    'Piutang': '#0891B2',
    'Persediaan': '#0EA5E9',
    'Aset Lancar Lain': '#60A5FA',
    'Aset Tetap': '#1D4ED8',
    'Aset Tak Berwujud': '#7C3AED',
    'Hutang': '#DC2626',
    'Hutang Pajak': '#EF4444',
    'Hutang Karyawan': '#F87171',
    'Hutang Jangka Panjang': '#991B1B',
    'Hutang Lain': '#B91C1C',
    'Modal': '#10B981',
    'Laba Ditahan': '#34D399',
    'Dividen': '#6EE7B7',
    'Penjualan': '#8B5CF6',
    'Pendapatan': '#A78BFA',
    'Pendapatan Lain': '#DDD6FE',
    'COGS': '#F59E0B',
    'Gaji & Tunjangan': '#FCD34D',
    'Utilitas': '#FBBF24',
    'Perawatan': '#FDBA74',
    'Pemasaran': '#FB923C',
    'Administrasi': '#F97316',
    'Penyusutan': '#EA580C',
    'Pajak': '#DC2626',
    'Beban Lain': '#D97706'
  }
  return colorMap[category] || '#6B7280'
}
