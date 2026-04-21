import { Prisma, TaxSourceType, TaxType } from "@prisma/client"
import { prisma } from "./prisma"

function roundAmount(value: number) {
  return Math.round(value * 100) / 100
}

function getPeriod(date: Date) {
  return {
    periodMonth: date.getMonth() + 1,
    periodYear: date.getFullYear(),
  }
}

export interface SyncTransactionTaxesInput {
  organizationId: string
  transactionId: string
  date: Date
  description: string
  reference?: string | null
  baseAmount: number
  ppnAmount?: number
  pph23Amount?: number
}

export async function syncTransactionTaxEntries(
  db: Prisma.TransactionClient,
  input: SyncTransactionTaxesInput
) {
  const { periodMonth, periodYear } = getPeriod(input.date)

  await db.taxEntry.deleteMany({
    where: { transactionId: input.transactionId },
  })

  const entries = [
    input.ppnAmount && input.ppnAmount > 0
      ? {
          organizationId: input.organizationId,
          transactionId: input.transactionId,
          sourceType: TaxSourceType.TRANSACTION,
          taxType: TaxType.PPN,
          date: input.date,
          periodMonth,
          periodYear,
          taxBase: roundAmount(input.baseAmount),
          taxAmount: roundAmount(input.ppnAmount),
          reference: input.reference || undefined,
          description: `PPN - ${input.description}`,
        }
      : null,
    input.pph23Amount && input.pph23Amount > 0
      ? {
          organizationId: input.organizationId,
          transactionId: input.transactionId,
          sourceType: TaxSourceType.TRANSACTION,
          taxType: TaxType.PPH23,
          date: input.date,
          periodMonth,
          periodYear,
          taxBase: roundAmount(input.baseAmount),
          taxAmount: roundAmount(input.pph23Amount),
          reference: input.reference || undefined,
          description: `PPh 23 - ${input.description}`,
        }
      : null,
  ].filter(Boolean) as Prisma.TaxEntryCreateManyInput[]

  if (entries.length > 0) {
    await db.taxEntry.createMany({ data: entries })
  }
}

export async function syncSalarySlipTaxEntries(input: {
  organizationId: string
  salarySlipId: string
  date: Date
  month: number
  year: number
  grossIncome: number
  pph21: number
  employeeName: string
}) {
  await prisma.taxEntry.deleteMany({
    where: { salarySlipId: input.salarySlipId },
  })

  if (input.pph21 <= 0) {
    return
  }

  await prisma.taxEntry.create({
    data: {
      organizationId: input.organizationId,
      salarySlipId: input.salarySlipId,
      sourceType: TaxSourceType.PAYROLL,
      taxType: TaxType.PPH21,
      date: input.date,
      periodMonth: input.month,
      periodYear: input.year,
      taxBase: roundAmount(input.grossIncome),
      taxAmount: roundAmount(input.pph21),
      description: `PPh 21 Payroll - ${input.employeeName}`,
    },
  })
}
