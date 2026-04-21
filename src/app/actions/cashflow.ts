"use server"

import { prisma } from "../../lib/prisma"
import { requireCurrentOrganization } from "../../lib/auth"

export async function getCashFlowStatement(startDate: Date, endDate: Date) {
  const { organization } = await requireCurrentOrganization()

  // Get all transactions within the period
  const transactions = await prisma.transaction.findMany({
    where: {
      organizationId: organization.id,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      lines: true,
    },
    orderBy: { date: "asc" },
  })

  // Get bank accounts for opening/closing balance
  const bankAccounts = await prisma.bankAccount.findMany({
    where: { organizationId: organization.id },
  })

  // Calculate cash flows by category
  const operatingIn = transactions
    .filter((t) => t.type === "IN")
    .filter((t) => {
      // Operating: regular income, not investment returns
      const account = organization.accounts?.find((a: any) => a.id === t.categoryAccountId)
      return account?.type !== "INVESTMENT"
    })
    .reduce((sum, t) => sum + t.amount, 0)

  const operatingOut = transactions
    .filter((t) => t.type === "OUT")
    .filter((t) => {
      // Operating: regular expenses, not investments
      const account = organization.accounts?.find((a: any) => a.id === t.categoryAccountId)
      return account?.type !== "INVESTMENT" && account?.type !== "ASSET"
    })
    .reduce((sum, t) => sum + t.amount, 0)

  // Investing activities
  const investingIn = transactions
    .filter((t) => t.type === "IN")
    .filter((t) => {
      const account = organization.accounts?.find((a: any) => a.id === t.categoryAccountId)
      return account?.type === "INVESTMENT"
    })
    .reduce((sum, t) => sum + t.amount, 0)

  const investingOut = transactions
    .filter((t) => t.type === "OUT")
    .filter((t) => {
      const account = organization.accounts?.find((a: any) => a.id === t.categoryAccountId)
      return account?.type === "INVESTMENT" || account?.type === "ASSET"
    })
    .reduce((sum, t) => sum + t.amount, 0)

  // Financing activities (loans, capital injections, etc.)
  const financingIn = transactions
    .filter((t) => t.type === "IN")
    .filter((t) => {
      const account = organization.accounts?.find((a: any) => a.id === t.categoryAccountId)
      return account?.code?.startsWith("MODAL") || account?.code?.startsWith("PINJAMAN")
    })
    .reduce((sum, t) => sum + t.amount, 0)

  const financingOut = transactions
    .filter((t) => t.type === "OUT")
    .filter((t) => {
      const account = organization.accounts?.find((a: any) => a.id === t.categoryAccountId)
      return account?.code?.startsWith("PINJAMAN") || account?.code?.startsWith("DIVIDEN")
    })
    .reduce((sum, t) => sum + t.amount, 0)

  // Net cash flows
  const operatingNet = operatingIn - operatingOut
  const investingNet = investingIn - investingOut
  const financingNet = financingIn - financingOut
  const netCashFlow = operatingNet + investingNet + financingNet

  // Beginning cash balance (sum of all bank accounts at start of period)
  const beginningBalance = bankAccounts.reduce((sum, acc) => sum + acc.balance, 0)

  // Ending cash balance
  const endingBalance = beginningBalance + netCashFlow

  return {
    period: { startDate, endDate },
    operating: { in: operatingIn, out: operatingOut, net: operatingNet },
    investing: { in: investingIn, out: investingOut, net: investingNet },
    financing: { in: financingIn, out: financingOut, net: financingNet },
    netCashFlow,
    beginningBalance,
    endingBalance,
    transactions,
  }
}
