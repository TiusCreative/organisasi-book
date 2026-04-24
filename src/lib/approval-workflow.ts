import type { Prisma } from "@prisma/client"

import { ensureApprovalWorkflowSchema } from "@/lib/approval-workflow-schema"

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
export type ApprovalDecision = "APPROVE" | "REJECT"

export type ApprovalRequestRow = {
  id: string
  organizationId: string
  entityType: string
  entityId: string
  status: ApprovalStatus
  requestedBy: string | null
  requestedAt: Date
  resolvedAt: Date | null
  resolvedBy: string | null
  resolutionNote: string | null
  createdAt: Date
  updatedAt: Date
}

export async function getPendingApprovalRequestByEntityInTx(
  tx: Prisma.TransactionClient,
  input: { organizationId: string; entityType: string; entityId: string },
): Promise<ApprovalRequestRow | null> {
  await ensureApprovalWorkflowSchema()
  const rows = await tx.$queryRawUnsafe<ApprovalRequestRow[]>(
    `
      SELECT *
      FROM "ApprovalRequest"
      WHERE "organizationId" = $1
        AND "entityType" = $2
        AND "entityId" = $3
        AND "status" = 'PENDING'
      LIMIT 1
    `,
    input.organizationId,
    input.entityType,
    input.entityId,
  )

  return rows[0] || null
}

export async function createApprovalRequestInTx(
  tx: Prisma.TransactionClient,
  input: { organizationId: string; entityType: string; entityId: string; requestedBy?: string | null },
): Promise<{ requestId: string }> {
  await ensureApprovalWorkflowSchema()

  const existing = await getPendingApprovalRequestByEntityInTx(tx, input)
  if (existing) {
    return { requestId: existing.id }
  }

  const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
    `
      INSERT INTO "ApprovalRequest" ("organizationId","entityType","entityId","status","requestedBy")
      VALUES ($1,$2,$3,'PENDING',$4)
      RETURNING "id"
    `,
    input.organizationId,
    input.entityType,
    input.entityId,
    input.requestedBy ?? null,
  )

  return { requestId: rows[0]!.id }
}

export async function resolveApprovalRequestInTx(
  tx: Prisma.TransactionClient,
  input: {
    requestId: string
    decision: ApprovalDecision
    decidedBy?: string | null
    note?: string | null
  },
): Promise<{ status: ApprovalStatus }> {
  await ensureApprovalWorkflowSchema()

  const reqRows = await tx.$queryRawUnsafe<Array<{ id: string; status: string }>>(
    `SELECT "id", "status" FROM "ApprovalRequest" WHERE "id" = $1 LIMIT 1`,
    input.requestId,
  )
  const req = reqRows[0]
  if (!req) {
    throw new Error("Approval request tidak ditemukan.")
  }
  if (req.status !== "PENDING") {
    throw new Error("Approval request sudah diproses.")
  }

  const nextStatus: ApprovalStatus = input.decision === "APPROVE" ? "APPROVED" : "REJECTED"

  await tx.$executeRawUnsafe(
    `
      UPDATE "ApprovalRequest"
      SET "status" = $2,
          "resolvedAt" = CURRENT_TIMESTAMP,
          "resolvedBy" = $3,
          "resolutionNote" = $4,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = $1
    `,
    input.requestId,
    nextStatus,
    input.decidedBy ?? null,
    input.note ?? null,
  )

  await tx.$executeRawUnsafe(
    `
      INSERT INTO "ApprovalDecision" ("requestId","decision","decidedBy","note")
      VALUES ($1,$2,$3,$4)
    `,
    input.requestId,
    input.decision,
    input.decidedBy ?? null,
    input.note ?? null,
  )

  return { status: nextStatus }
}

