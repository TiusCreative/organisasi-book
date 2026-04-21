import { prisma } from "./prisma"

export interface InvestmentReportFilters {
  organizationId: string
  type?: string
  status?: string
  startDate?: Date
  endDate?: Date
}

export async function generateInvestmentReport(filters: InvestmentReportFilters) {
  const where = {
    organizationId: filters.organizationId,
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.startDate || filters.endDate
      ? {
          startDate: {
            ...(filters.startDate ? { gte: filters.startDate } : {}),
            ...(filters.endDate ? { lte: filters.endDate } : {}),
          },
        }
      : {}),
  }

  const investments = await prisma.investment.findMany({
    where,
    include: {
      account: true,
      sourceBankAccount: true,
      settlementBankAccount: true,
    },
    orderBy: [{ type: "asc" }, { startDate: "desc" }],
  })

  const rows = investments.map((investment) => {
    const unrealizedGainLoss = Number(investment.currentValue) - Number(investment.purchaseAmount)
    const realizedGainLoss =
      investment.status === "LIQUIDATED"
        ? Number(investment.currentValue) - Number(investment.purchaseAmount)
        : 0

    return {
      ...investment,
      unrealizedGainLoss,
      realizedGainLoss,
    }
  })

  const summary = {
    totalInvestments: rows.length,
    totalPurchaseAmount: rows.reduce((sum, row) => sum + Number(row.purchaseAmount), 0),
    totalCurrentValue: rows.reduce((sum, row) => sum + Number(row.currentValue), 0),
    totalExpectedReturn: rows.reduce((sum, row) => sum + Number(row.expectedReturn || 0), 0),
    totalUnrealizedGainLoss: rows.reduce((sum, row) => sum + row.unrealizedGainLoss, 0),
    totalRealizedGainLoss: rows.reduce((sum, row) => sum + row.realizedGainLoss, 0),
  }

  const byType = rows.reduce<Record<string, { count: number; purchaseAmount: number; currentValue: number }>>((acc, row) => {
    if (!acc[row.type]) {
      acc[row.type] = { count: 0, purchaseAmount: 0, currentValue: 0 }
    }

    acc[row.type].count += 1
    acc[row.type].purchaseAmount += Number(row.purchaseAmount)
    acc[row.type].currentValue += Number(row.currentValue)
    return acc
  }, {})

  return {
    filters,
    rows,
    summary,
    byType,
  }
}
