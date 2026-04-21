import { prisma } from './prisma'

export interface PeriodLockInput {
  organizationId: string
  year: number
  month?: number
  lockType: 'PERIOD' | 'YEAR' | 'FULL'
  lockedBy: string
  lockedByName?: string
  reason?: string
}

/**
 * Cek apakah period tertentu terkunci
 */
export async function isPeriodLocked(
  organizationId: string,
  date: Date
): Promise<{ locked: boolean; lockInfo?: any }> {
  const year = date.getFullYear()
  const month = date.getMonth() + 1

  // Cek lock full (semua period)
  const fullLock = await prisma.periodLock.findFirst({
    where: {
      organizationId,
      lockType: 'FULL',
      isLocked: true,
    },
  })

  if (fullLock) {
    return { locked: true, lockInfo: fullLock }
  }

  // Cek lock tahun
  const yearLock = await prisma.periodLock.findFirst({
    where: {
      organizationId,
      year,
      lockType: 'YEAR',
      isLocked: true,
    },
  })

  if (yearLock) {
    return { locked: true, lockInfo: yearLock }
  }

  // Cek lock per bulan
  const monthLock = await prisma.periodLock.findFirst({
    where: {
      organizationId,
      year,
      month,
      lockType: 'PERIOD',
      isLocked: true,
    },
  })

  if (monthLock) {
    return { locked: true, lockInfo: monthLock }
  }

  return { locked: false }
}

/**
 * Lock period
 */
export async function lockPeriod(input: PeriodLockInput) {
  const { organizationId, year, month, lockType, lockedBy, lockedByName, reason } = input

  const existingLock = await prisma.periodLock.findFirst({
    where: {
      organizationId,
      year,
      month: month || null,
    },
  })

  if (existingLock) {
    // Update existing lock
    return prisma.periodLock.update({
      where: { id: existingLock.id },
      data: {
        lockType,
        lockedBy,
        lockedByName,
        reason,
        isLocked: true,
        unlockedAt: null,
        unlockedBy: null,
        unlockedByName: null,
        unlockReason: null,
      },
    })
  }

  // Create new lock
  return prisma.periodLock.create({
    data: {
      organizationId,
      year,
      month,
      lockType,
      lockedBy,
      lockedByName,
      reason,
    },
  })
}

/**
 * Unlock period
 */
export async function unlockPeriod(
  organizationId: string,
  year: number,
  month: number | null,
  unlockedBy: string,
  unlockedByName?: string,
  unlockReason?: string
) {
  const lock = await prisma.periodLock.findFirst({
    where: {
      organizationId,
      year,
      month: month || null,
    },
  })

  if (!lock) {
    throw new Error('Period lock tidak ditemukan')
  }

  return prisma.periodLock.update({
    where: { id: lock.id },
    data: {
      isLocked: false,
      unlockedAt: new Date(),
      unlockedBy,
      unlockedByName,
      unlockReason,
    },
  })
}

/**
 * Get all period locks for organization
 */
export async function getPeriodLocks(organizationId: string) {
  return prisma.periodLock.findMany({
    where: { organizationId },
    orderBy: [
      { year: 'desc' },
      { month: 'desc' },
      { lockedAt: 'desc' },
    ],
  })
}

/**
 * Get locked periods
 */
export async function getLockedPeriods(organizationId: string) {
  return prisma.periodLock.findMany({
    where: {
      organizationId,
      isLocked: true,
    },
    orderBy: [
      { year: 'desc' },
      { month: 'desc' },
    ],
  })
}
