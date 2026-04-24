import type { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { isPeriodLockedInTx } from "@/lib/period-lock"

export type JournalLineInput = {
  accountId: string
  debit?: number
  credit?: number
  description?: string
}

export type JournalInput = {
  organizationId: string
  date?: Date
  description: string
  reference?: string | null
  lines: JournalLineInput[]
  audit?: {
    entity?: string
    userId?: string
    userName?: string
    userEmail?: string
  }
}

const JOURNAL_TOLERANCE = 0.01

function roundAmount(value: number) {
  return Math.round(value * 100) / 100
}

function normalizeLines(lines: JournalLineInput[]) {
  return lines.map((line) => ({
    accountId: line.accountId,
    debit: roundAmount(Number(line.debit || 0)),
    credit: roundAmount(Number(line.credit || 0)),
    description: line.description || null,
  }))
}

function validateBalancedJournal(lines: JournalLineInput[]) {
  const normalizedLines = normalizeLines(lines)

  if (normalizedLines.length < 2) {
    throw new Error("Jurnal minimal harus memiliki 2 baris")
  }

  for (const [index, line] of normalizedLines.entries()) {
    if (!line.accountId) {
      throw new Error(`Baris jurnal #${index + 1} tidak memiliki accountId`)
    }
    if (line.debit < 0 || line.credit < 0) {
      throw new Error(`Baris jurnal #${index + 1} tidak boleh negatif`)
    }
    if (line.debit > 0 && line.credit > 0) {
      throw new Error(`Baris jurnal #${index + 1} tidak boleh memiliki debit dan kredit sekaligus`)
    }
    if (line.debit === 0 && line.credit === 0) {
      throw new Error(`Baris jurnal #${index + 1} tidak boleh 0/0`)
    }
  }

  const totalDebit = roundAmount(normalizedLines.reduce((sum, line) => sum + line.debit, 0))
  const totalCredit = roundAmount(normalizedLines.reduce((sum, line) => sum + line.credit, 0))

  if (Math.abs(totalDebit - totalCredit) > JOURNAL_TOLERANCE) {
    throw new Error(`Jurnal tidak balance: debit ${totalDebit} dan kredit ${totalCredit}`)
  }

  return {
    normalizedLines,
    totalDebit,
    totalCredit,
  }
}

function formatLockInfo(lockInfo: unknown) {
  if (!lockInfo || typeof lockInfo !== "object") return "Periode terkunci"
  const info = lockInfo as { year?: unknown; month?: unknown; lockType?: unknown }
  const year = typeof info.year === "number" ? info.year : undefined
  const lockType = typeof info.lockType === "string" ? info.lockType : "UNKNOWN"
  const month = typeof info.month === "number" ? String(info.month).padStart(2, "0") : null
  const suffix = lockType === "PERIOD" && year && month ? `${year}-${month}` : year ? String(year) : "-"
  return `Periode terkunci (${lockType} ${suffix})`
}

export async function createJournalInTx(tx: Prisma.TransactionClient, input: JournalInput) {
  const date = input.date || new Date()
  const lockState = await isPeriodLockedInTx(tx, input.organizationId, date)
  if (lockState.locked) {
    throw new Error(formatLockInfo(lockState.lockInfo))
  }

  const { normalizedLines, totalDebit, totalCredit } = validateBalancedJournal(input.lines)

  const header = await tx.transaction.create({
    data: {
      organizationId: input.organizationId,
      date,
      description: input.description,
      reference: input.reference ?? null,
    },
    select: { id: true },
  })

  await tx.transactionLine.createMany({
    data: normalizedLines.map((line) => ({
      transactionId: header.id,
      accountId: line.accountId,
      debit: line.debit,
      credit: line.credit,
      description: line.description,
    })),
  })

  try {
    await tx.auditLog.create({
      data: {
        organizationId: input.organizationId,
        action: "CREATE",
        entity: input.audit?.entity || "Transaction",
        entityId: header.id,
        userId: input.audit?.userId,
        userName: input.audit?.userName,
        userEmail: input.audit?.userEmail,
        newData: JSON.stringify({
          date: date.toISOString(),
          description: input.description,
          reference: input.reference ?? null,
          totalDebit,
          totalCredit,
          lines: normalizedLines,
        }),
        status: "SUCCESS",
      },
    })
  } catch (error) {
    console.error("Error logging audit trail for journal:", error)
  }

  return {
    transactionId: header.id,
    totalDebit,
    totalCredit,
  }
}

export async function createJournal(input: JournalInput) {
  return prisma.$transaction((tx) => createJournalInTx(tx, input))
}
