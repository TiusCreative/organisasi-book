/**
 * Audit Logger - Mencatat semua perubahan data keuangan
 * Implementasi untuk AuditLog model di Prisma
 */

import { prisma } from './prisma'

export interface AuditLogInput {
  organizationId: string
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'READ' | 'EXPORT'
  entity: string // e.g., 'Transaction', 'Employee', 'SalarySlip', 'PayrollJournal'
  entityId: string
  userId?: string
  userName?: string
  userEmail?: string
  oldData?: string | Record<string, any>
  newData?: string | Record<string, any>
  changes?: string | Record<string, any>
  reason?: string
  ipAddress?: string
  userAgent?: string
  status?: 'SUCCESS' | 'FAILED'
  errorMessage?: string
}

/**
 * Convert object to JSON string if needed
 */
function stringifyData(data: any): string | undefined {
  if (!data) return undefined
  if (typeof data === 'string') return data
  try {
    return JSON.stringify(data)
  } catch {
    return String(data)
  }
}

/**
 * Get summary of changes between old and new data
 */
function getChangeSummary(
  oldData: any,
  newData: any
): Record<string, { old: any; new: any }> | undefined {
  if (!oldData || !newData) return undefined

  const oldObj = typeof oldData === 'string' ? JSON.parse(oldData) : oldData
  const newObj = typeof newData === 'string' ? JSON.parse(newData) : newData

  const changes: Record<string, { old: any; new: any }> = {}

  for (const key in newObj) {
    if (oldObj[key] !== newObj[key]) {
      changes[key] = {
        old: oldObj[key],
        new: newObj[key],
      }
    }
  }

  return Object.keys(changes).length > 0 ? changes : undefined
}

/**
 * Log audit trail
 */
export async function logAudit(input: AuditLogInput): Promise<void> {
  try {
    const oldDataStr = stringifyData(input.oldData)
    const newDataStr = stringifyData(input.newData)

    let changesStr: string | undefined
    if (input.changes) {
      changesStr = stringifyData(input.changes)
    } else if (input.action === 'UPDATE' && oldDataStr && newDataStr) {
      const changes = getChangeSummary(oldDataStr, newDataStr)
      changesStr = changes ? JSON.stringify(changes) : undefined
    }

    await prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        userId: input.userId,
        userName: input.userName,
        userEmail: input.userEmail,
        oldData: oldDataStr,
        newData: newDataStr,
        changes: changesStr,
        reason: input.reason,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        status: input.status || 'SUCCESS',
        errorMessage: input.errorMessage,
      },
    })
  } catch (error) {
    // Don't throw error from audit logging - log to console instead
    console.error('Error logging audit trail:', error)
  }
}

/**
 * Get audit logs for organization
 */
export async function getAuditLogs(input: {
  organizationId: string
  action?: string
  entity?: string
  entityId?: string
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}) {
  const { organizationId, action, entity, entityId, startDate, endDate, limit = 100, offset = 0 } = input

  const where: any = { organizationId }

  if (action) where.action = action
  if (entity) where.entity = entity
  if (entityId) where.entityId = entityId

  if (startDate || endDate) {
    where.timestamp = {}
    if (startDate) where.timestamp.gte = startDate
    if (endDate) where.timestamp.lte = endDate
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.auditLog.count({ where }),
  ])

  return {
    logs,
    total,
    limit,
    offset,
  }
}

/**
 * Get audit trail untuk specific entity
 */
export async function getEntityAuditTrail(organizationId: string, entityId: string) {
  return prisma.auditLog.findMany({
    where: {
      organizationId,
      entityId,
    },
    orderBy: { timestamp: 'asc' },
  })
}

/**
 * Export audit logs sebagai CSV
 */
export async function exportAuditLogsAsCSV(input: {
  organizationId: string
  startDate?: Date
  endDate?: Date
}): Promise<string> {
  const logs = await getAuditLogs({
    organizationId: input.organizationId,
    startDate: input.startDate,
    endDate: input.endDate,
    limit: 10000,
  })

  const headers = [
    'Timestamp',
    'Action',
    'Entity',
    'Entity ID',
    'User',
    'User Email',
    'Status',
    'Changes',
    'Error',
  ]

  const rows = logs.logs.map((log) => [
    log.timestamp.toISOString(),
    log.action,
    log.entity,
    log.entityId,
    log.userName || log.userId || '-',
    log.userEmail || '-',
    log.status,
    log.changes ? log.changes.substring(0, 100) : '-',
    log.errorMessage || '-',
  ])

  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')

  return csv
}

/**
 * Get audit statistics
 */
export async function getAuditStatistics(input: {
  organizationId: string
  startDate?: Date
  endDate?: Date
}) {
  const where: any = { organizationId: input.organizationId }

  if (input.startDate || input.endDate) {
    where.timestamp = {}
    if (input.startDate) where.timestamp.gte = input.startDate
    if (input.endDate) where.timestamp.lte = input.endDate
  }

  const [total, byAction, byEntity, byStatus] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({
      by: ['action'],
      where,
      _count: true,
    }),
    prisma.auditLog.groupBy({
      by: ['entity'],
      where,
      _count: true,
    }),
    prisma.auditLog.groupBy({
      by: ['status'],
      where,
      _count: true,
    }),
  ])

  return {
    total,
    byAction: Object.fromEntries(byAction.map((a) => [a.action, a._count])),
    byEntity: Object.fromEntries(byEntity.map((e) => [e.entity, e._count])),
    byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
  }
}

/**
 * Delete old audit logs (data retention)
 */
export async function deleteOldAuditLogs(organizationId: string, daysOld: number = 365): Promise<number> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysOld)

  const result = await prisma.auditLog.deleteMany({
    where: {
      organizationId,
      timestamp: {
        lt: cutoffDate,
      },
    },
  })

  return result.count
}

/**
 * Middleware helper untuk auto-logging dari server actions
 */
export function createAuditedAction<T extends any[], R>(
  action: (...args: T) => Promise<R>,
  auditConfig: {
    entity: string
    action: AuditLogInput['action']
    getEntityId: (...args: T) => string
    getOrgId: (...args: T) => string
    getUserId?: (...args: T) => string
  }
) {
  return async (...args: T): Promise<R> => {
    const startTime = Date.now()
    let result: R
    let error: Error | null = null

    try {
      result = await action(...args)
      return result
    } catch (e) {
      error = e instanceof Error ? e : new Error(String(e))
      throw error
    } finally {
      // Log audit
      const duration = Date.now() - startTime
      await logAudit({
        organizationId: auditConfig.getOrgId(...args),
        action: auditConfig.action,
        entity: auditConfig.entity,
        entityId: auditConfig.getEntityId(...args),
        userId: auditConfig.getUserId?.(...args),
        status: error ? 'FAILED' : 'SUCCESS',
        errorMessage: error?.message,
      })
    }
  }
}
