import { prisma } from "./prisma"

export interface BankOutstandingReport {
  period: {
    startDate: Date
    endDate: Date
  }
  banks: Array<{
    bankId: string
    accountId: string
    bankName: string
    accountNumber: string
    accountName: string
    openingBalance: number
    totalIn: number
    totalOut: number
    ledgerEndingBalance: number
    statementBalance: number
    outstanding: number
    transactions: Array<{
      transactionId: string
      reference: string | null
      date: Date
      description: string
      direction: "IN" | "OUT"
      amount: number
    }>
  }>
}

const roundAmount = (value: number) => Math.round(value * 100) / 100

export async function generateBankOutstandingReport(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<BankOutstandingReport> {
  const bankAccounts = await prisma.bankAccount.findMany({
    where: { organizationId },
    include: {
      account: {
        include: {
          journalItems: {
            include: {
              transaction: true,
            },
            orderBy: {
              transaction: {
                date: "asc",
              },
            },
          },
        },
      },
    },
    orderBy: [
      { bankName: "asc" },
      { accountNumber: "asc" },
    ],
  })

  const banks = bankAccounts.map((bank) => {
    const openingBalance = roundAmount(
      bank.account.journalItems
        .filter((item) => item.transaction.date < startDate)
        .reduce((sum, item) => sum + item.debit - item.credit, 0)
    )

    const periodItems = bank.account.journalItems.filter(
      (item) => item.transaction.date >= startDate && item.transaction.date <= endDate
    )

    const totalIn = roundAmount(periodItems.reduce((sum, item) => sum + item.debit, 0))
    const totalOut = roundAmount(periodItems.reduce((sum, item) => sum + item.credit, 0))
    const ledgerEndingBalance = roundAmount(openingBalance + totalIn - totalOut)
    const statementBalance = roundAmount(bank.balance || 0)

    return {
      bankId: bank.id,
      accountId: bank.accountId,
      bankName: bank.bankName,
      accountNumber: bank.accountNumber,
      accountName: bank.accountName,
      openingBalance,
      totalIn,
      totalOut,
      ledgerEndingBalance,
      statementBalance,
      outstanding: roundAmount(statementBalance - ledgerEndingBalance),
      transactions: periodItems.map((item) => ({
        transactionId: item.transactionId,
        reference: item.transaction.reference,
        date: item.transaction.date,
        description: item.transaction.description,
        direction: (item.debit > 0 ? "IN" : "OUT") as "IN" | "OUT",
        amount: roundAmount(item.debit > 0 ? item.debit : item.credit),
      })),
    }
  })

  return {
    period: {
      startDate,
      endDate,
    },
    banks,
  }
}
