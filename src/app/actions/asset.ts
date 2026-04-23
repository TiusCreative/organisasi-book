'use server'

import { prisma } from '../../lib/prisma'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { requireCurrentOrganization } from '../../lib/auth'
import { hasModulePermission } from '../../lib/permissions'

export interface Asset {
  id?: string
  organizationId: string
  name: string
  code: string
  description?: string
  category: string
  purchaseDate: Date
  purchasePrice: number
  residualValue: number
  usefulLife: number
  depreciationMethod: 'straight-line' | 'declining-balance' | 'production'
  status: string
}

const FIXED_ASSET_ACCOUNT_MAP: Record<string, { asset: string; accumulated: string; expense: string }> = {
  Tanah: { asset: '1700', accumulated: '1751', expense: '5640' },
  Bangunan: { asset: '1710', accumulated: '1711', expense: '5600' },
  Kendaraan: { asset: '1720', accumulated: '1721', expense: '5610' },
  Mesin: { asset: '1730', accumulated: '1731', expense: '5620' },
  Peralatan: { asset: '1740', accumulated: '1741', expense: '5630' },
  Furniture: { asset: '1740', accumulated: '1741', expense: '5630' },
  Elektronik: { asset: '1740', accumulated: '1741', expense: '5630' },
  'Aset Tak Berwujud': { asset: '1760', accumulated: '1761', expense: '5650' },
  Lainnya: { asset: '1750', accumulated: '1751', expense: '5640' },
}

function normalizeDepreciationMethod(method: string) {
  if (method === 'declining-balance') {
    return 'DECLINING_BALANCE'
  }

  if (method === 'production') {
    return 'UNITS_OF_PRODUCTION'
  }

  return 'STRAIGHT_LINE'
}

// CREATE ASSET
export async function createAsset(formData: FormData) {
  try {
    const { user, organization } = await requireCurrentOrganization()

    // Permission check: hanya ADMIN, MANAGER yang bisa membuat aset
    if (!hasModulePermission(user, "assets")) {
      throw new Error('Anda tidak memiliki izin untuk membuat data aset.')
    }

    const organizationId = organization.id
    const name = formData.get('name') as string
    const code = formData.get('code') as string
    const category = formData.get('category') as string
    const purchaseDate = new Date(formData.get('purchaseDate') as string)
    const purchasePrice = parseFloat(formData.get('purchasePrice') as string)
    const residualValue = parseFloat(formData.get('residualValue') as string)
    const usefulLife = parseInt(formData.get('usefulLife') as string)
    const depreciationMethod = (formData.get('depreciationMethod') as string) || 'straight-line'
    const description = formData.get('description') as string

    if (!name || !code || !category || !purchasePrice || !usefulLife) {
      throw new Error('Data aset tidak lengkap')
    }

    const orgExists = await prisma.organization.findUnique({
      where: { id: organizationId }
    })

    if (!orgExists) {
      throw new Error('Organisasi tidak ditemukan')
    }

    const mappedCodes = FIXED_ASSET_ACCOUNT_MAP[category] || FIXED_ASSET_ACCOUNT_MAP.Lainnya
    const accounts = await prisma.chartOfAccount.findMany({
      where: {
        organizationId,
        code: {
          in: [mappedCodes.asset, mappedCodes.accumulated, mappedCodes.expense],
        },
      },
      select: {
        id: true,
        code: true,
      },
    })

    const assetAccountId = accounts.find((account) => account.code === mappedCodes.asset)?.id || null
    const accumulatedDepreciationAccountId = accounts.find((account) => account.code === mappedCodes.accumulated)?.id
    const depreciationExpenseAccountId = accounts.find((account) => account.code === mappedCodes.expense)?.id

    if (!accumulatedDepreciationAccountId || !depreciationExpenseAccountId) {
      throw new Error('Akun penyusutan belum tersedia. Silakan inisialisasi daftar akun terlebih dahulu di menu Akun.')
    }

    const usefulLifeMonths = usefulLife * 12

    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO fixed_assets (
        organization_id,
        asset_account_id,
        depreciation_expense_account_id,
        accumulated_depreciation_account_id,
        name,
        code,
        category,
        purchase_date,
        purchase_price,
        residual_value,
        useful_life_months,
        depreciation_method,
        status
      )
      VALUES (
        ${organizationId},
        ${assetAccountId},
        ${depreciationExpenseAccountId},
        ${accumulatedDepreciationAccountId},
        ${name},
        ${code},
        ${category},
        ${purchaseDate},
        ${purchasePrice},
        ${residualValue},
        ${usefulLifeMonths},
        ${normalizeDepreciationMethod(depreciationMethod)},
        'ACTIVE'
      )
    `)

    revalidatePath('/aset')
    revalidatePath('/penyusutan')

    return {
      success: true,
      asset: {
        organizationId,
        name,
        code,
        category,
        purchaseDate,
        purchasePrice,
        residualValue,
        usefulLife,
        depreciationMethod,
        description,
        status: 'ACTIVE'
      }
    }
  } catch (error) {
    console.error('Create asset error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Gagal membuat data aset' }
  }
}

// UPDATE ASSET
export async function updateAsset(formData: FormData) {
  try {
    const { user } = await requireCurrentOrganization()

    // Permission check: hanya ADMIN, MANAGER yang bisa update aset
    if (!hasModulePermission(user, "assets")) {
      throw new Error('Anda tidak memiliki izin untuk mengubah data aset.')
    }

    const id = formData.get('id') as string
    const name = formData.get('name') as string
    const category = formData.get('category') as string
    const purchasePrice = parseFloat(formData.get('purchasePrice') as string)
    const residualValue = parseFloat(formData.get('residualValue') as string)
    const usefulLife = parseInt(formData.get('usefulLife') as string)
    const depreciationMethod = (formData.get('depreciationMethod') as string) || 'straight-line'
    const status = (formData.get('status') as string) || 'ACTIVE'

    return {
      success: true,
      asset: {
        id,
        name,
        category,
        purchasePrice,
        residualValue,
        usefulLife,
        depreciationMethod,
        status
      }
    }
  } catch (error) {
    console.error('Update asset error:', error)
    return { success: false, error: 'Gagal mengupdate data aset' }
  }
}

// DELETE ASSET
export async function deleteAsset(id: string) {
  try {
    const { user } = await requireCurrentOrganization()

    // Permission check: hanya ADMIN yang bisa hapus aset
    if (user.role !== "ADMIN") {
      throw new Error('Anda tidak memiliki izin untuk menghapus data aset. Hanya admin yang dapat menghapus.')
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        DELETE FROM fixed_asset_depreciation_runs
        WHERE fixed_asset_id = ${id}::uuid
      `)

      await tx.$executeRaw(Prisma.sql`
        DELETE FROM fixed_assets
        WHERE id = ${id}::uuid
      `)
    })

    revalidatePath('/aset')
    revalidatePath('/penyusutan')
    return { success: true }
  } catch (error) {
    console.error('Delete asset error:', error)
    return { success: false, error: 'Gagal menghapus data aset' }
  }
}

// GET ASSETS FOR ORGANIZATION
export async function getOrganizationAssets(organizationId: string) {
  try {
    const assets = await prisma.$queryRaw<Array<{
      id: string
      name: string
      code: string
      category: string | null
      purchase_date: Date
      purchase_price: number
      residual_value: number
      useful_life_months: number
      depreciation_method: string
      status: string
    }>>(Prisma.sql`
      SELECT
        id,
        name,
        code,
        category,
        purchase_date,
        purchase_price,
        residual_value,
        useful_life_months,
        depreciation_method,
        status
      FROM fixed_assets
      WHERE organization_id = ${organizationId}::uuid
      ORDER BY purchase_date DESC, code ASC
    `)

    return { success: true, assets }
  } catch (error) {
    console.error('Get assets error:', error)
    return { success: false, assets: [] }
  }
}
