'use server'

/**
 * Server Actions untuk Payroll Processing dengan Automasi Jurnal
 */

import { prisma } from '../../lib/prisma'
import { createPayrollJournal, PayrollJournalInput } from '../../lib/payroll-journal'
import { logAudit } from '../../lib/audit-logger'

/**
 * Process salary slip dan create journal entry otomatis
 */
export async function processSalarySlipWithJournal(input: {
  salarySlipId: string
  organizationId: string
  userId?: string
  autoCreateJournal?: boolean
}) {
  const { salarySlipId, organizationId, userId, autoCreateJournal = true } = input

  try {
    // 1. Fetch salary slip
    const salarySlip = await prisma.salarySlip.findUniqueOrThrow({
      where: { id: salarySlipId },
      include: { employee: true },
    })

    // 2. Validate slip is finalized
    if (salarySlip.status === 'DRAFT') {
      await logAudit({
        organizationId,
        action: 'UPDATE',
        entity: 'SalarySlip',
        entityId: salarySlipId,
        userId,
        status: 'FAILED',
        errorMessage: 'Slip harus di-finalize terlebih dahulu',
      })

      return {
        success: false,
        error: 'Slip harus di-finalize sebelum membuat jurnal',
      }
    }

    // 3. If auto create journal enabled
    if (autoCreateJournal && salarySlip.status !== 'CANCELLED') {
      const journalInput: PayrollJournalInput = {
        organizationId,
        employeeId: salarySlip.employeeId,
        month: salarySlip.month,
        year: salarySlip.year,
        baseSalary: salarySlip.baseSalary,
        totalAllowance: salarySlip.totalAllowance,
        totalDeduction: salarySlip.totalDeduction,
        bpjsKesehatanEmployee: salarySlip.bpjsKesehatanEmployee,
        bpjsKetenagakerjaan: salarySlip.bpjsKetenagakerjaan,
        pph21: salarySlip.pph21,
        grossIncome: salarySlip.grossIncome,
        netIncome: salarySlip.netIncome,
        salarySlipId,
        userId,
      }

      const journalResult = await createPayrollJournal(journalInput)

      if (!journalResult.success) {
        return {
          success: false,
          error: journalResult.error,
        }
      }

      // 4. Update slip status to FINALIZED
      await prisma.salarySlip.update({
        where: { id: salarySlipId },
        data: {
          status: 'FINALIZED',
        },
      })

      await logAudit({
        organizationId,
        action: 'UPDATE',
        entity: 'SalarySlip',
        entityId: salarySlipId,
        userId,
        newData: JSON.stringify({
          status: 'FINALIZED',
          journalCreated: true,
        }),
        status: 'SUCCESS',
      })

      return {
        success: true,
        message: 'Slip difinalisasi dan jurnal dibuat',
        journalId: journalResult.journalId,
        lines: journalResult.lines,
      }
    }

    return {
      success: true,
      message: 'Proses selesai',
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    await logAudit({
      organizationId,
      action: 'UPDATE',
      entity: 'SalarySlip',
      entityId: salarySlipId,
      userId,
      status: 'FAILED',
      errorMessage,
    })

    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Finalize salary slip (prepare untuk pembayaran)
 */
export async function finalizeSalarySlip(input: {
  salarySlipId: string
  organizationId: string
  createJournal?: boolean
  userId?: string
}) {
  const { salarySlipId, organizationId, createJournal = true, userId } = input

  try {
    const salarySlip = await prisma.salarySlip.findUniqueOrThrow({
      where: { id: salarySlipId },
    })

    // Update status
    const updated = await prisma.salarySlip.update({
      where: { id: salarySlipId },
      data: {
        status: 'FINALIZED',
        updatedAt: new Date(),
      },
    })

    // Optionally create journal
    if (createJournal) {
      const result = await processSalarySlipWithJournal({
        salarySlipId,
        organizationId,
        userId,
        autoCreateJournal: true,
      })

      return result
    }

    await logAudit({
      organizationId,
      action: 'UPDATE',
      entity: 'SalarySlip',
      entityId: salarySlipId,
      userId,
      newData: JSON.stringify({ status: updated.status }),
      status: 'SUCCESS',
    })

    return {
      success: true,
      message: 'Slip difinalisasi',
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Record salary payment
 */
export async function recordSalaryPayment(input: {
  salarySlipId: string
  organizationId: string
  paymentDate: Date
  bankAccountId?: string
  notes?: string
  userId?: string
}) {
  const { salarySlipId, organizationId, paymentDate, bankAccountId, notes, userId } = input

  try {
    const salarySlip = await prisma.salarySlip.findUniqueOrThrow({
      where: { id: salarySlipId },
      include: { employee: true },
    })

    // Update slip to PAID
    const updated = await prisma.salarySlip.update({
      where: { id: salarySlipId },
      data: {
        status: 'PAID',
        paymentDate,
        notes,
        updatedAt: new Date(),
      },
    })

    await logAudit({
      organizationId,
      action: 'UPDATE',
      entity: 'SalarySlip',
      entityId: salarySlipId,
      userId,
      newData: JSON.stringify({
        status: updated.status,
        paymentDate,
        bankAccountId,
      }),
      reason: 'Pembayaran gaji ditandai lunas tanpa jurnal tambahan karena payroll sudah diposting langsung ke Kas/Bank',
      status: 'SUCCESS',
    })

    return {
      success: true,
      message: 'Pembayaran gaji tercatat',
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    await logAudit({
      organizationId,
      action: 'UPDATE',
      entity: 'SalarySlip',
      entityId: salarySlipId,
      userId,
      status: 'FAILED',
      errorMessage,
    })

    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Get payroll processing summary
 */
export async function getPayrollSummary(input: {
  organizationId: string
  month: number
  year: number
}) {
  const { organizationId, month, year } = input

  try {
    const slips = await prisma.salarySlip.findMany({
      where: {
        organizationId,
        month,
        year,
      },
      include: {
        employee: true,
      },
      orderBy: { employee: { name: 'asc' } },
    })

    const summary = {
      total: slips.length,
      draft: slips.filter((s) => s.status === 'DRAFT').length,
      finalized: slips.filter((s) => s.status === 'FINALIZED').length,
      paid: slips.filter((s) => s.status === 'PAID').length,
      totalGrossSalary: slips.reduce((sum, s) => sum + s.grossIncome, 0),
      totalNetSalary: slips.reduce((sum, s) => sum + s.netIncome, 0),
      totalDeductions: slips.reduce(
        (sum, s) =>
          sum +
          (s.totalDeduction +
            s.bpjsKesehatanEmployee +
            s.bpjsKetenagakerjaan +
            s.pph21),
        0
      ),
      slips,
    }

    return {
      success: true,
      data: summary,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Batch process salary slips (finalize & create journals)
 */
export async function batchProcessSalarySlips(input: {
  organizationId: string
  month: number
  year: number
  userId?: string
}) {
  const { organizationId, month, year, userId } = input

  try {
    const slips = await prisma.salarySlip.findMany({
      where: {
        organizationId,
        month,
        year,
        status: 'DRAFT',
      },
    })

    const results = []
    for (const slip of slips) {
      const result = await finalizeSalarySlip({
        salarySlipId: slip.id,
        organizationId,
        createJournal: true,
        userId,
      })
      results.push({
        slipId: slip.id,
        ...result,
      })
    }

    await logAudit({
      organizationId,
      action: 'CREATE',
      entity: 'PayrollBatch',
      entityId: `batch-${month}-${year}`,
      userId,
      newData: JSON.stringify({
        month,
        year,
        processed: slips.length,
      }),
      status: 'SUCCESS',
    })

    return {
      success: true,
      processed: results.length,
      results,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    await logAudit({
      organizationId,
      action: 'CREATE',
      entity: 'PayrollBatch',
      entityId: `batch-${month}-${year}`,
      userId,
      status: 'FAILED',
      errorMessage,
    })

    return {
      success: false,
      error: errorMessage,
    }
  }
}
