import { prisma } from "@/lib/prisma"

let ensurePromise: Promise<void> | null = null

async function run(sql: string) {
  await prisma.$executeRawUnsafe(sql)
}

async function ensureApprovalWorkflowSchemaInternal() {
  await run(`
    CREATE TABLE IF NOT EXISTS "ApprovalRequest" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "organizationId" TEXT NOT NULL,
      "entityType" TEXT NOT NULL,
      "entityId" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "requestedBy" TEXT,
      "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "resolvedAt" TIMESTAMP(3),
      "resolvedBy" TEXT,
      "resolutionNote" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ApprovalRequest_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS "ApprovalDecision" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "requestId" TEXT NOT NULL,
      "decision" TEXT NOT NULL,
      "decidedBy" TEXT,
      "note" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ApprovalDecision_requestId_fkey"
        FOREIGN KEY ("requestId") REFERENCES "ApprovalRequest"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `)

  const indexes = [
    `CREATE INDEX IF NOT EXISTS "ApprovalRequest_organizationId_idx" ON "ApprovalRequest"("organizationId")`,
    `CREATE INDEX IF NOT EXISTS "ApprovalRequest_entity_idx" ON "ApprovalRequest"("entityType","entityId")`,
    `CREATE INDEX IF NOT EXISTS "ApprovalRequest_status_idx" ON "ApprovalRequest"("status")`,
    `CREATE INDEX IF NOT EXISTS "ApprovalDecision_requestId_idx" ON "ApprovalDecision"("requestId")`,
    `CREATE INDEX IF NOT EXISTS "ApprovalDecision_createdAt_idx" ON "ApprovalDecision"("createdAt")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "ApprovalRequest_pending_entity_unique"
      ON "ApprovalRequest"("organizationId","entityType","entityId")
      WHERE "status" = 'PENDING'`,
  ]

  for (const sql of indexes) {
    await run(sql)
  }
}

export async function ensureApprovalWorkflowSchema() {
  if (!ensurePromise) {
    ensurePromise = ensureApprovalWorkflowSchemaInternal().catch((error) => {
      ensurePromise = null
      throw error
    })
  }

  await ensurePromise
}

