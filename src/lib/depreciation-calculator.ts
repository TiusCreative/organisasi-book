/**
 * Depreciation Calculator - Sistem Penyusutan Aset Tetap
 * Metode: Garis Lurus (Straight Line), Saldo Menurun Ganda (Double Declining), Produksi
 * Format: IDR (Rupiah), SAK Indonesia
 */

export type DepreciationMethod = 'STRAIGHT_LINE' | 'DECLINING_BALANCE' | 'UNITS_OF_PRODUCTION'

export interface FixedAssetData {
  id: string
  code: string
  name: string
  category: string
  purchaseDate: Date
  purchasePrice: number
  residualValue: number
  usefulLifeYears: number
  usefulLifeMonths: number
  depreciationMethod: DepreciationMethod
  status: 'ACTIVE' | 'RETIRED' | 'DISPOSED'
  productionUnitsTotal?: number
  productionUnitsProduced?: number
}

export interface DepreciationCalculation {
  assetId: string
  assetCode: string
  assetName: string
  period: {
    month: number
    year: number
    startDate: Date
    endDate: Date
  }
  purchasePrice: number
  residualValue: number
  bookValueBeginning: number
  depreciationExpense: number
  accumulatedDepreciation: number
  bookValueEnding: number
  depreciationRate: number
  method: DepreciationMethod
}

/**
 * Calculate monthly depreciation using Straight Line Method
 * Formula: (Purchase Price - Residual Value) / (Useful Life in Months)
 */
export function calculateStraightLineDepreciation(
  asset: FixedAssetData,
  month: number,
  year: number
): DepreciationCalculation {
  const depreciableBase = asset.purchasePrice - asset.residualValue
  const totalMonths = asset.usefulLifeYears * 12 + asset.usefulLifeMonths
  const monthlyDepreciation = depreciableBase / totalMonths

  // Calculate months since purchase
  const purchaseDate = asset.purchaseDate
  const currentDate = new Date(year, month - 1, 1)
  const monthsSincePurchase = calculateMonthsBetween(purchaseDate, currentDate)

  // Calculate accumulated depreciation up to this month
  const accumulatedDepreciation = Math.min(
    monthlyDepreciation * (monthsSincePurchase + 1),
    depreciableBase
  )

  const bookValueBeginning = asset.purchasePrice - Math.max(0, monthlyDepreciation * monthsSincePurchase)
  const bookValueEnding = asset.purchasePrice - accumulatedDepreciation

  const depreciationRate = (depreciableBase / totalMonths / asset.purchasePrice) * 100

  // Don't depreciate if asset hasn't reached useful life yet
  const isActive = monthsSincePurchase < totalMonths && asset.status === 'ACTIVE'
  const monthlyExpense = isActive ? monthlyDepreciation : 0

  return {
    assetId: asset.id,
    assetCode: asset.code,
    assetName: asset.name,
    period: {
      month,
      year,
      startDate: new Date(year, month - 1, 1),
      endDate: new Date(year, month, 0),
    },
    purchasePrice: asset.purchasePrice,
    residualValue: asset.residualValue,
    bookValueBeginning,
    depreciationExpense: monthlyExpense,
    accumulatedDepreciation,
    bookValueEnding,
    depreciationRate,
    method: 'STRAIGHT_LINE',
  }
}

/**
 * Calculate monthly depreciation using Double Declining Balance Method
 * Formula: 2 × (1 / Useful Life in Years) × Book Value Beginning of Period
 */
export function calculateDeciningBalanceDepreciation(
  asset: FixedAssetData,
  month: number,
  year: number
): DepreciationCalculation {
  const straightLineRate = 1 / asset.usefulLifeYears
  const decliningRate = 2 * straightLineRate

  const purchaseDate = asset.purchaseDate
  const currentDate = new Date(year, month - 1, 1)
  const monthsSincePurchase = calculateMonthsBetween(purchaseDate, currentDate)

  // Calculate book value at beginning of period
  let bookValueBeginning = asset.purchasePrice
  for (let i = 0; i < monthsSincePurchase; i++) {
    const monthlyRate = decliningRate / 12
    const monthlyExpense = bookValueBeginning * monthlyRate
    bookValueBeginning -= monthlyExpense
  }

  // Apply residual value floor
  bookValueBeginning = Math.max(asset.residualValue, bookValueBeginning)

  const monthlyRate = decliningRate / 12
  const depreciationExpense = bookValueBeginning * monthlyRate
  const bookValueEnding = Math.max(asset.residualValue, bookValueBeginning - depreciationExpense)

  const accumulatedDepreciation = asset.purchasePrice - bookValueEnding

  const isActive = bookValueEnding > asset.residualValue && asset.status === 'ACTIVE'
  const monthlyExpense = isActive ? depreciationExpense : 0

  return {
    assetId: asset.id,
    assetCode: asset.code,
    assetName: asset.name,
    period: {
      month,
      year,
      startDate: new Date(year, month - 1, 1),
      endDate: new Date(year, month, 0),
    },
    purchasePrice: asset.purchasePrice,
    residualValue: asset.residualValue,
    bookValueBeginning,
    depreciationExpense: monthlyExpense,
    accumulatedDepreciation,
    bookValueEnding,
    depreciationRate: decliningRate * 100,
    method: 'DECLINING_BALANCE',
  }
}

/**
 * Calculate depreciation using Units of Production Method
 * Formula: (Purchase Price - Residual Value) / Total Units × Units Produced
 */
export function calculateUnitsOfProductionDepreciation(
  asset: FixedAssetData,
  month: number,
  year: number,
  unitsProducedThisMonth: number
): DepreciationCalculation {
  if (!asset.productionUnitsTotal || asset.productionUnitsTotal === 0) {
    throw new Error('Total production units harus didefinisikan untuk metode Units of Production')
  }

  const depreciableBase = asset.purchasePrice - asset.residualValue
  const costPerUnit = depreciableBase / asset.productionUnitsTotal

  const depreciationExpense = costPerUnit * unitsProducedThisMonth
  const totalUnitsProduced = (asset.productionUnitsProduced || 0) + unitsProducedThisMonth
  const accumulatedDepreciation = costPerUnit * totalUnitsProduced
  const bookValueEnding = Math.max(asset.residualValue, asset.purchasePrice - accumulatedDepreciation)
  const bookValueBeginning = asset.purchasePrice - (accumulatedDepreciation - depreciationExpense)

  const depreciationRate = (totalUnitsProduced / asset.productionUnitsTotal) * 100

  const isActive = totalUnitsProduced < asset.productionUnitsTotal && asset.status === 'ACTIVE'
  const monthlyExpense = isActive ? depreciationExpense : 0

  return {
    assetId: asset.id,
    assetCode: asset.code,
    assetName: asset.name,
    period: {
      month,
      year,
      startDate: new Date(year, month - 1, 1),
      endDate: new Date(year, month, 0),
    },
    purchasePrice: asset.purchasePrice,
    residualValue: asset.residualValue,
    bookValueBeginning,
    depreciationExpense: monthlyExpense,
    accumulatedDepreciation,
    bookValueEnding,
    depreciationRate,
    method: 'UNITS_OF_PRODUCTION',
  }
}

/**
 * Calculate depreciation berdasarkan method yang dipilih
 */
export function calculateDepreciation(
  asset: FixedAssetData,
  month: number,
  year: number,
  unitsProducedThisMonth: number = 0
): DepreciationCalculation {
  switch (asset.depreciationMethod) {
    case 'STRAIGHT_LINE':
      return calculateStraightLineDepreciation(asset, month, year)

    case 'DECLINING_BALANCE':
      return calculateDeciningBalanceDepreciation(asset, month, year)

    case 'UNITS_OF_PRODUCTION':
      return calculateUnitsOfProductionDepreciation(asset, month, year, unitsProducedThisMonth)

    default:
      throw new Error(`Unknown depreciation method: ${asset.depreciationMethod}`)
  }
}

/**
 * Validate depreciation input
 */
export function validateDepreciationInput(asset: FixedAssetData): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (asset.purchasePrice <= 0) {
    errors.push('Harga perolehan harus lebih besar dari 0')
  }

  if (asset.residualValue < 0) {
    errors.push('Nilai residu tidak boleh negatif')
  }

  if (asset.residualValue >= asset.purchasePrice) {
    errors.push('Nilai residu harus kurang dari harga perolehan')
  }

  if (asset.usefulLifeYears <= 0 && asset.usefulLifeMonths <= 0) {
    errors.push('Masa manfaat harus lebih besar dari 0')
  }

  if (asset.purchaseDate > new Date()) {
    errors.push('Tanggal perolehan tidak boleh di masa depan')
  }

  if (asset.depreciationMethod === 'UNITS_OF_PRODUCTION') {
    if (!asset.productionUnitsTotal || asset.productionUnitsTotal <= 0) {
      errors.push('Total unit produksi harus didefinisikan untuk metode Units of Production')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Calculate months between two dates
 */
function calculateMonthsBetween(startDate: Date, endDate: Date): number {
  let months = 0
  let tempDate = new Date(startDate)

  while (tempDate < endDate) {
    tempDate.setMonth(tempDate.getMonth() + 1)
    if (tempDate <= endDate) {
      months++
    }
  }

  return months
}

/**
 * Calculate depreciation schedule untuk seluruh umur aset
 */
export function calculateDepreciationSchedule(asset: FixedAssetData): DepreciationCalculation[] {
  const schedule: DepreciationCalculation[] = []
  const startDate = asset.purchaseDate
  const totalMonths = asset.usefulLifeYears * 12 + asset.usefulLifeMonths
  let currentDate = new Date(startDate)

  for (let i = 0; i < totalMonths; i++) {
    const month = currentDate.getMonth() + 1
    const year = currentDate.getFullYear()

    const calculation = calculateDepreciation(asset, month, year, 0)
    schedule.push(calculation)

    currentDate.setMonth(currentDate.getMonth() + 1)
  }

  return schedule
}

/**
 * Get summary of asset depreciation status
 */
export function getDepreciationSummary(
  assets: FixedAssetData[],
  month: number,
  year: number
): {
  totalBookValue: number
  totalAccumulatedDepreciation: number
  totalMonthlyExpense: number
  assets: Array<DepreciationCalculation>
} {
  const calculations = assets.map((asset) => calculateDepreciation(asset, month, year, 0))

  return {
    totalBookValue: calculations.reduce((sum, c) => sum + c.bookValueEnding, 0),
    totalAccumulatedDepreciation: calculations.reduce((sum, c) => sum + c.accumulatedDepreciation, 0),
    totalMonthlyExpense: calculations.reduce((sum, c) => sum + c.depreciationExpense, 0),
    assets: calculations,
  }
}

/**
 * Format depreciation for display
 */
export function formatDepreciation(calc: DepreciationCalculation): string {
  return `
${calc.assetName} (${calc.assetCode})
Periode: ${calc.period.month}/${calc.period.year}
Metode: ${calc.method}

Harga Perolehan:          Rp ${calc.purchasePrice.toLocaleString('id-ID')}
Nilai Residu:             Rp ${calc.residualValue.toLocaleString('id-ID')}
Akumulasi Penyusutan:     Rp ${calc.accumulatedDepreciation.toLocaleString('id-ID')}
Nilai Buku Awal Periode:  Rp ${calc.bookValueBeginning.toLocaleString('id-ID')}
Beban Penyusutan:         Rp ${calc.depreciationExpense.toLocaleString('id-ID')}
Nilai Buku Akhir Periode: Rp ${calc.bookValueEnding.toLocaleString('id-ID')}
`
}
