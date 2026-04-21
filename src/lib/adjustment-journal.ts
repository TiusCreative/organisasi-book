import { prisma } from "./prisma"
import { generateNoteNumber } from "./nota-generator"
import { logAudit } from "./audit-logger"

export interface AdjustmentJournalLineInput {
  accountId: string
  debit?: number
  credit?: number
  description?: string
}

export interface AdjustmentJournalInput {
  organizationId: string
  date: Date
  description: string
  adjustmentType: "ACCRUAL" | "PREPAID" | "DEFERRED_REVENUE" | "RECLASS" | "MANUAL"
  lines: AdjustmentJournalLineInput[]
  userId?: string
}

const JOURNAL_TOLERANCE = 0.01

function roundAmount(value: number) {
  return Math.round(value * 100) / 100
}

function summarizeLines(lines: AdjustmentJournalLineInput[]) {
  return lines.map((line) => ({
    accountId: line.accountId,
    debit: roundAmount(line.debit || 0),
    credit: roundAmount(line.credit || 0),
    description: line.description || null,
  }))
}

function validateBalancedAdjustment(lines: AdjustmentJournalLineInput[]) {
  const normalizedLines = summarizeLines(lines)
  const totalDebit = roundAmount(normalizedLines.reduce((sum, line) => sum + line.debit, 0))
  const totalCredit = roundAmount(normalizedLines.reduce((sum, line) => sum + line.credit, 0))

  if (normalizedLines.length < 2) {
    throw new Error("Jurnal penyesuaian minimal harus memiliki 2 baris")
  }

  if (Math.abs(totalDebit - totalCredit) > JOURNAL_TOLERANCE) {
    throw new Error(`Jurnal penyesuaian tidak balance: debit ${totalDebit} dan kredit ${totalCredit}`)
  }

  return {
    totalDebit,
    totalCredit,
    normalizedLines,
  }
}

export async function createAdjustmentJournal(input: AdjustmentJournalInput) {
  const { totalDebit, totalCredit, normalizedLines } = validateBalancedAdjustment(input.lines)
  const reference = await generateNoteNumber({
    organizationId: input.organizationId,
    code: "JU",
  })

  const transaction = await prisma.transaction.create({
    data: {
      organizationId: input.organizationId,
      date: input.date,
      description: `[${input.adjustmentType}] ${input.description}`,
      reference,
      lines: {
        create: normalizedLines,
      },
    },
    include: {
      lines: true,
    },
  })

  await logAudit({
    organizationId: input.organizationId,
    action: "CREATE",
    entity: "AdjustmentJournal",
    entityId: transaction.id,
    userId: input.userId,
    newData: {
      adjustmentType: input.adjustmentType,
      reference,
      lines: normalizedLines,
      totalDebit,
      totalCredit,
    },
  })

  return {
    success: true,
    transaction,
    totalDebit,
    totalCredit,
  }
}
