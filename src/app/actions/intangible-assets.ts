"use server"

import { prisma } from "@/lib/prisma"
import { requireModuleAccess } from "@/lib/auth"

export type IntangibleAssetRow = {
  id: string
  code: string
  name: string
  category: string | null
  purchaseDate: string
  purchasePrice: number
  residualValue: number
  usefulLifeMonths: number
  depreciationMethod: string
  status: string
  accumulatedAmortization: number
  bookValue: number
}

export async function getIntangibleAssetsReport() {
  const { organization } = await requireModuleAccess("reports")

  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: string
        code: string
        name: string
        category: string | null
        purchase_date: Date
        purchase_price: number
        residual_value: number
        useful_life_months: number
        depreciation_method: string
        status: string
        accumulated_amortization: number
        book_value: number
      }>
    >(
      `
        SELECT
          assets.id,
          assets.code,
          assets.name,
          assets.category,
          assets.purchase_date,
          assets.purchase_price,
          assets.residual_value,
          assets.useful_life_months,
          assets.depreciation_method,
          assets.status,
          COALESCE(MAX(runs.accumulated_depreciation), 0) AS accumulated_amortization,
          assets.purchase_price - COALESCE(MAX(runs.accumulated_depreciation), 0) AS book_value
        FROM fixed_assets assets
        LEFT JOIN fixed_asset_depreciation_runs runs ON runs.fixed_asset_id = assets.id
        WHERE assets.organization_id = $1
          AND assets.category = 'Aset Tak Berwujud'
        GROUP BY assets.id
        ORDER BY assets.purchase_date DESC, assets.code ASC
      `,
      organization.id,
    )

    const data: IntangibleAssetRow[] = rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      category: r.category,
      purchaseDate: r.purchase_date.toISOString(),
      purchasePrice: Number(r.purchase_price || 0),
      residualValue: Number(r.residual_value || 0),
      usefulLifeMonths: Number(r.useful_life_months || 0),
      depreciationMethod: String(r.depreciation_method || ""),
      status: String(r.status || ""),
      accumulatedAmortization: Number(r.accumulated_amortization || 0),
      bookValue: Number(r.book_value || 0),
    }))

    const totals = {
      purchasePrice: data.reduce((s, r) => s + r.purchasePrice, 0),
      accumulatedAmortization: data.reduce((s, r) => s + r.accumulatedAmortization, 0),
      bookValue: data.reduce((s, r) => s + r.bookValue, 0),
    }

    return {
      organizationId: organization.id,
      organizationName: organization.name,
      rows: data,
      totals,
    }
  } catch (error) {
    // Table might not exist yet in a fresh DB.
    return {
      organizationId: organization.id,
      organizationName: organization.name,
      rows: [] as IntangibleAssetRow[],
      totals: { purchasePrice: 0, accumulatedAmortization: 0, bookValue: 0 },
      error: "Data aset tidak tersedia (pastikan schema fixed_assets sudah terbuat dan ada data).",
    }
  }
}

