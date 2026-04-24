import { prisma } from "./prisma"
import { createJournal } from "@/lib/accounting/journal"
import { generateNoteNumber } from "./nota-generator"

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

export async function createAdjustmentJournal(input: AdjustmentJournalInput) {
  const reference = await generateNoteNumber({
    organizationId: input.organizationId,
    code: "JU",
  })

  const posted = await createJournal({
    organizationId: input.organizationId,
    date: input.date,
    description: `[${input.adjustmentType}] ${input.description}`,
    reference,
    lines: input.lines,
    audit: {
      entity: "AdjustmentJournal",
      userId: input.userId,
    },
  })

  const transaction = await prisma.transaction.findUnique({
    where: { id: posted.transactionId },
    include: { lines: true },
  })

  return {
    success: true,
    transaction,
    totalDebit: posted.totalDebit,
    totalCredit: posted.totalCredit,
  }
}
