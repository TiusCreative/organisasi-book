import { prisma } from '../src/lib/prisma'

type FixedAssetRow = {
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
}

const roundAmount = (value: number) => Math.round(value * 100) / 100

function getTargetPeriod() {
  const now = new Date()
  const argMonth = Number(process.argv[2] || now.getMonth() + 1)
  const argYear = Number(process.argv[3] || now.getFullYear())

  if (argMonth < 1 || argMonth > 12) {
    throw new Error('Bulan harus antara 1-12')
  }

  return {
    month: argMonth,
    year: argYear,
    periodStart: new Date(argYear, argMonth - 1, 1),
    periodEnd: new Date(argYear, argMonth, 0, 23, 59, 59, 999),
  }
}

function calculateMonthDifference(startDate: Date, endDate: Date) {
  return (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth())
}

function calculateStraightLineMonthlyDepreciation(asset: FixedAssetRow) {
  const depreciableBase = Number(asset.purchase_price) - Number(asset.residual_value)

  if (asset.useful_life_months <= 0) {
    throw new Error(`Masa manfaat aset ${asset.code} harus lebih besar dari 0`)
  }

  if (depreciableBase <= 0) {
    return 0
  }

  return roundAmount(depreciableBase / asset.useful_life_months)
}

async function run() {
  const { month, year, periodStart, periodEnd } = getTargetPeriod()

  const assets = await prisma.$queryRaw<FixedAssetRow[]>`
    SELECT *
    FROM fixed_assets
    WHERE status = 'ACTIVE'
      AND depreciation_method = 'STRAIGHT_LINE'
      AND purchase_date <= ${periodEnd}
    ORDER BY purchase_date ASC, code ASC
  `

  const results: Array<{ assetCode: string; posted: boolean; amount: number; message: string }> = []

  for (const asset of assets) {
    const monthsElapsed = calculateMonthDifference(new Date(asset.purchase_date), periodStart)

    if (monthsElapsed < 0 || monthsElapsed >= asset.useful_life_months) {
      results.push({
        assetCode: asset.code,
        posted: false,
        amount: 0,
        message: 'Tidak masuk periode penyusutan',
      })
      continue
    }

    const monthlyDepreciation = calculateStraightLineMonthlyDepreciation(asset)
    const accumulatedDepreciation = roundAmount(monthlyDepreciation * (monthsElapsed + 1))
    const maxDepreciation = roundAmount(Number(asset.purchase_price) - Number(asset.residual_value))
    const depreciationAmount = Math.min(monthlyDepreciation, maxDepreciation)
    const accumulatedDepreciationCapped = Math.min(accumulatedDepreciation, maxDepreciation)
    const bookValueEnding = roundAmount(Number(asset.purchase_price) - accumulatedDepreciationCapped)
    const reference = `DEP-${year}-${String(month).padStart(2, '0')}-${asset.code}`

    try {
      await prisma.$transaction(async (tx) => {
        const existingRun = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id
          FROM fixed_asset_depreciation_runs
          WHERE fixed_asset_id = ${asset.id}
            AND month = ${month}
            AND year = ${year}
          LIMIT 1
        `

        if (existingRun.length > 0) {
          return
        }

        const transaction = await tx.transaction.create({
          data: {
            organizationId: asset.organization_id,
            date: periodEnd,
            description: `Penyusutan Bulanan ${asset.name} - ${month}/${year}`,
            reference,
            lines: {
              create: [
                {
                  accountId: asset.depreciation_expense_account_id,
                  debit: depreciationAmount,
                  credit: 0,
                  description: `Beban penyusutan ${asset.name}`,
                },
                {
                  accountId: asset.accumulated_depreciation_account_id,
                  debit: 0,
                  credit: depreciationAmount,
                  description: `Akumulasi penyusutan ${asset.name}`,
                },
              ],
            },
          },
        })

        await tx.$executeRaw`
          INSERT INTO fixed_asset_depreciation_runs (
            fixed_asset_id,
            transaction_id,
            month,
            year,
            depreciation_amount,
            accumulated_depreciation,
            book_value_ending
          )
          VALUES (
            ${asset.id},
            ${transaction.id},
            ${month},
            ${year},
            ${depreciationAmount},
            ${accumulatedDepreciationCapped},
            ${bookValueEnding}
          )
        `
      })

      results.push({
        assetCode: asset.code,
        posted: true,
        amount: depreciationAmount,
        message: 'Jurnal penyusutan berhasil diposting',
      })
    } catch (error) {
      results.push({
        assetCode: asset.code,
        posted: false,
        amount: depreciationAmount,
        message: error instanceof Error ? error.message : 'Gagal memproses penyusutan',
      })
    }
  }

  console.table(results)
}

run()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
