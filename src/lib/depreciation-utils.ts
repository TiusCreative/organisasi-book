// Depreciation calculation utilities based on Indonesian accounting standards

export interface FixedAsset {
  id: string
  name: string
  code: string
  acquisitionDate: Date
  acquisitionCost: number
  usefulLife: number // in years
  residualValue: number
  depreciationMethod: 'straight-line' | 'declining-balance' | 'production'
  productionCapacity?: number // for production method
  productionUsed?: number // for production method
  accumulatedDepreciation?: number
}

export interface DepreciationSchedule {
  year: number
  beginningValue: number
  depreciationExpense: number
  accumulatedDepreciation: number
  bookValue: number
}

/**
 * Calculate straight-line depreciation
 * Formula: (Cost - Residual Value) / Useful Life
 */
export const calculateStraightLineDepreciation = (
  asset: FixedAsset
): number => {
  return (asset.acquisitionCost - asset.residualValue) / asset.usefulLife
}

/**
 * Calculate declining balance depreciation
 * Formula: Book Value × (1 - Depreciation Rate)
 * Depreciation Rate = 1 / Useful Life
 */
export const calculateDecliningBalanceDepreciation = (
  asset: FixedAsset,
  year: number
): number => {
  const depreciationRate = 1 / asset.usefulLife
  const doubleRate = depreciationRate * 2 // Double declining balance
  
  let bookValue = asset.acquisitionCost
  for (let i = 1; i < year; i++) {
    const depreciation = bookValue * doubleRate
    bookValue -= depreciation
  }
  
  return bookValue * doubleRate
}

/**
 * Calculate production-based depreciation
 * Formula: (Cost - Residual Value) × (Production This Year / Total Production Capacity)
 */
export const calculateProductionDepreciation = (
  asset: FixedAsset,
  productionThisYear: number
): number => {
  if (!asset.productionCapacity) {
    throw new Error("Production capacity is required for production method")
  }
  
  return (
    (asset.acquisitionCost - asset.residualValue) *
    (productionThisYear / asset.productionCapacity)
  )
}

/**
 * Generate depreciation schedule for an asset
 */
export const generateDepreciationSchedule = (
  asset: FixedAsset
): DepreciationSchedule[] => {
  const schedule: DepreciationSchedule[] = []
  let bookValue = asset.acquisitionCost
  let accumulatedDepreciation = 0
  
  for (let year = 1; year <= asset.usefulLife; year++) {
    let depreciationExpense = 0
    
    if (asset.depreciationMethod === 'straight-line') {
      depreciationExpense = calculateStraightLineDepreciation(asset)
    } else if (asset.depreciationMethod === 'declining-balance') {
      depreciationExpense = calculateDecliningBalanceDepreciation(asset, year)
    }
    
    // Ensure book value doesn't go below residual value
    if (bookValue - depreciationExpense < asset.residualValue) {
      depreciationExpense = bookValue - asset.residualValue
    }
    
    accumulatedDepreciation += depreciationExpense
    bookValue -= depreciationExpense
    
    schedule.push({
      year,
      beginningValue: bookValue + depreciationExpense,
      depreciationExpense,
      accumulatedDepreciation,
      bookValue
    })
  }
  
  return schedule
}

/**
 * Calculate current year depreciation
 */
export const calculateCurrentYearDepreciation = (
  asset: FixedAsset
): number => {
  const yearsInUse = calculateYearsInUse(asset.acquisitionDate)
  
  if (yearsInUse >= asset.usefulLife) {
    return 0 // Asset fully depreciated
  }
  
  if (asset.depreciationMethod === 'straight-line') {
    return calculateStraightLineDepreciation(asset)
  } else if (asset.depreciationMethod === 'declining-balance') {
    return calculateDecliningBalanceDepreciation(asset, yearsInUse + 1)
  }
  
  return 0
}

/**
 * Calculate years in use
 */
export const calculateYearsInUse = (acquisitionDate: Date): number => {
  const now = new Date()
  const years = now.getFullYear() - acquisitionDate.getFullYear()
  return Math.max(0, years)
}

/**
 * Calculate book value at current date
 */
export const calculateBookValue = (asset: FixedAsset): number => {
  const yearsInUse = calculateYearsInUse(asset.acquisitionDate)
  
  if (yearsInUse === 0) {
    return asset.acquisitionCost
  }
  
  if (asset.depreciationMethod === 'straight-line') {
    const annualDepreciation = calculateStraightLineDepreciation(asset)
    const totalDepreciation = Math.min(
      annualDepreciation * yearsInUse,
      asset.acquisitionCost - asset.residualValue
    )
    return asset.acquisitionCost - totalDepreciation
  } else if (asset.depreciationMethod === 'declining-balance') {
    const depreciationRate = 2 / asset.usefulLife
    let bookValue = asset.acquisitionCost
    
    for (let i = 0; i < yearsInUse; i++) {
      bookValue -= bookValue * depreciationRate
    }
    
    return Math.max(bookValue, asset.residualValue)
  }
  
  return asset.acquisitionCost
}

/**
 * Calculate accumulated depreciation
 */
export const calculateAccumulatedDepreciation = (asset: FixedAsset): number => {
  const bookValue = calculateBookValue(asset)
  return asset.acquisitionCost - bookValue
}
