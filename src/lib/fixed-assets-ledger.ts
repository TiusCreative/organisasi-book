import { prisma } from "./prisma"

export interface FixedAssetLedgerRow {
  id: string
  organization_id: string
  asset_account_id: string | null
  depreciation_expense_account_id: string
  accumulated_depreciation_account_id: string
  name: string
  code: string
  category: string | null
  purchase_date: Date
  purchase_price: number
  residual_value: number
  useful_life_months: number
  depreciation_method: string
  status: string
  accumulated_depreciation?: number
  book_value?: number
}

export async function getFixedAssetsWithBookValue(organizationId: string): Promise<FixedAssetLedgerRow[]> {
  try {
    const rows = await prisma.$queryRaw<FixedAssetLedgerRow[]>`
      SELECT
        assets.*,
        COALESCE(MAX(runs.accumulated_depreciation), 0) AS accumulated_depreciation,
        assets.purchase_price - COALESCE(MAX(runs.accumulated_depreciation), 0) AS book_value
      FROM fixed_assets assets
      LEFT JOIN fixed_asset_depreciation_runs runs ON runs.fixed_asset_id = assets.id
      WHERE assets.organization_id = ${organizationId}
      GROUP BY assets.id
      ORDER BY assets.purchase_date ASC, assets.code ASC
    `

    return rows.map((row) => ({
      ...row,
      accumulated_depreciation: Number(row.accumulated_depreciation || 0),
      book_value: Number(row.book_value || row.purchase_price),
    }))
  } catch (error) {
    return []
  }
}
