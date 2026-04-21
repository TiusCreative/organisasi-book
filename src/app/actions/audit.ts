"use server"

import { prisma } from "../../lib/prisma"
import { requireCurrentOrganization } from "../../lib/auth"

export async function getAuditLogsAction(params: {
  action?: string
  entity?: string
  entityId?: string
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
}) {
  const { organization } = await requireCurrentOrganization()
  
  const { action, entity, entityId, startDate, endDate, limit = 100, offset = 0 } = params

  const where: any = { organizationId: organization.id }

  if (action) where.action = action
  if (entity) where.entity = entity
  if (entityId) where.entityId = entityId

  if (startDate || endDate) {
    where.timestamp = {}
    if (startDate) where.timestamp.gte = new Date(startDate)
    if (endDate) where.timestamp.lte = new Date(endDate)
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

export async function exportAuditLogsAsCSVAction(params: {
  startDate?: string
  endDate?: string
}) {
  const { organization } = await requireCurrentOrganization()
  
  const result = await getAuditLogsAction({
    startDate: params.startDate,
    endDate: params.endDate,
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

  const rows = result.logs.map((log) => [
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
