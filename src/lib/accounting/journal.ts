import type { Prisma } from "@prisma/client"

export type JournalLineInput = {
  accountId: string
  debit: number
  credit: number
  description?: string
}

export type CreateJournalInput = {
  organizationId: string
  date: Date
  reference: string
  description: string
  lines: JournalLineInput[]
}

/**
 * Core Function: Membuat jurnal akuntansi terpusat di dalam Prisma Transaction.
 * Memastikan integritas Double-Entry Bookkeeping dan Period Lock.
 */
export async function createJournalInTx(
  tx: Prisma.TransactionClient,
  input: CreateJournalInput
) {
  // 1. Pengecekan Period Lock (Validasi Tutup Buku)
  const year = input.date.getFullYear()
  const month = input.date.getMonth() + 1 // JS months are 0-11

  const periodLock = await tx.periodLock.findUnique({
    where: {
      organizationId_year_month: {
        organizationId: input.organizationId,
        year: year,
        month: month,
      }
    }
  })

  if (periodLock?.isLocked) {
    throw new Error(`Transaksi ditolak: Periode Akuntansi ${month}-${year} sudah ditutup (Period Lock).`)
  }

  // 2. Validasi Double-Entry (Debit wajib sama dengan Kredit)
  // Catatan: Gunakan Math.round / toleransi untuk menghindari floating point issue di JS
  const totalDebit = input.lines.reduce((sum, line) => sum + line.debit, 0)
  const totalCredit = input.lines.reduce((sum, line) => sum + line.credit, 0)

  const roundedDebit = Math.round(totalDebit * 100) / 100
  const roundedCredit = Math.round(totalCredit * 100) / 100

  if (Math.abs(roundedDebit - roundedCredit) > 0.01) {
    throw new Error(
      `Jurnal tidak balance! Total Debit: ${roundedDebit}, Total Kredit: ${roundedCredit}. Selisih: ${Math.abs(roundedDebit - roundedCredit)}`
    )
  }

  // 3. Simpan ke database (Sesuai skema Transaction dan TransactionLine)
  const transaction = await tx.transaction.create({
    data: {
      organizationId: input.organizationId,
      date: input.date,
      reference: input.reference,
      description: input.description,
      lines: {
        create: input.lines.map(line => ({
          accountId: line.accountId,
          debit: line.debit,
          credit: line.credit,
          description: line.description || input.description,
        }))
      }
    },
    include: { lines: true }
  })

  return transaction
}