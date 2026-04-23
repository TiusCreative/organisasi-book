"use server"

import { Prisma, type WorkOrderCostType } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireCurrentOrganization, requireModuleAccess, requireWritableCurrentOrganization } from "@/lib/auth"
import { ensureWorkOrderHppSchema } from "@/lib/work-order-schema"
import { explodeBom, validateNoCircularBomDependency } from "@/lib/bom"
import { postInventoryMovementInTx } from "@/lib/inventory-ledger"
import { postWorkOrderCompleteJournalInTx, postWorkOrderIssueMaterialJournalInTx } from "@/lib/inventory-accounting"
import { revalidatePath } from "next/cache"

const ALLOWED_WORK_ORDER_STATUSES = new Set([
  "PENDING", // legacy status
  "DRAFT",
  "RELEASED",
  "IN_PROGRESS",
  "COMPLETED",
  "CLOSED",
  "CANCELLED",
])

const ACTUAL_COST_FIELDS: Record<Exclude<WorkOrderCostType, "WASTE">, keyof Prisma.WorkOrderUpdateInput> = {
  LABOR: "actualLaborCost",
  OVERHEAD: "actualOverheadCost",
  MACHINE: "actualMachineCost",
  SUBCONTRACT: "actualSubcontractCost",
}

function buildActualTotalCost(input: {
  actualMaterialCost: number
  actualLaborCost: number
  actualOverheadCost: number
  actualMachineCost: number
  actualSubcontractCost: number
  actualWasteValue: number
}) {
  return (
    input.actualMaterialCost +
    input.actualLaborCost +
    input.actualOverheadCost +
    input.actualMachineCost +
    input.actualSubcontractCost -
    input.actualWasteValue
  )
}

function buildNextAutoWorkOrderCode(parentCode: string, index: number) {
  return `${parentCode}-SF-${String(index).padStart(3, "0")}`
}

export async function getWorkOrders(organizationId: string) {
  const { organization } = await requireModuleAccess("workOrder")
  if (!organization || organization.id !== organizationId) {
    throw new Error("Unauthorized")
  }
  await ensureWorkOrderHppSchema()

  const workOrders = await prisma.workOrder.findMany({
    where: { organizationId },
    include: {
      assignedUser: {
        select: { id: true, name: true, email: true },
      },
      customer: {
        select: { id: true, name: true, code: true },
      },
      productItem: {
        select: { id: true, code: true, name: true, unit: true },
      },
      bom: {
        select: { id: true, code: true, name: true, version: true },
      },
      items: true,
      materialIssues: {
        include: {
          item: { select: { id: true, code: true, name: true, unit: true } },
        },
      },
      costEntries: true,
    },
    orderBy: { createdAt: "desc" },
  })

  if (workOrders.length === 0) {
    return workOrders
  }

  type ChainRow = {
    parentWorkOrderId: string
    childWorkOrderId: string
    componentItemId: string
    requiredQty: number
    generationLevel: number
    childCode: string
    childTitle: string
    childStatus: string
    childPlannedQty: number
    childActualQty: number
    componentCode: string | null
    componentName: string | null
  }

  const workOrderIds = workOrders.map((wo) => wo.id)
  const chainRows = await prisma.$queryRawUnsafe<ChainRow[]>(
    `
      SELECT
        l."parentWorkOrderId",
        l."childWorkOrderId",
        l."componentItemId",
        l."requiredQty",
        l."generationLevel",
        child."code" AS "childCode",
        child."title" AS "childTitle",
        child."status" AS "childStatus",
        child."plannedQty" AS "childPlannedQty",
        child."actualQty" AS "childActualQty",
        component."code" AS "componentCode",
        component."name" AS "componentName"
      FROM "WorkOrderChainLink" l
      INNER JOIN "WorkOrder" child ON child."id" = l."childWorkOrderId"
      LEFT JOIN "InventoryItem" component ON component."id" = l."componentItemId"
      WHERE l."organizationId" = $1
        AND l."parentWorkOrderId" = ANY($2::text[])
      ORDER BY l."generationLevel" ASC, child."createdAt" ASC
    `,
    organizationId,
    workOrderIds,
  )

  const chainByParent = new Map<string, ChainRow[]>()
  for (const row of chainRows) {
    const current = chainByParent.get(row.parentWorkOrderId) || []
    current.push(row)
    chainByParent.set(row.parentWorkOrderId, current)
  }

  return workOrders.map((wo) => ({
    ...wo,
    chainChildren: chainByParent.get(wo.id) || [],
  }))
}

export async function createWorkOrder(data: {
  organizationId: string
  code: string
  barcode?: string
  title: string
  description?: string
  customerId?: string
  productItemId?: string
  bomId?: string
  plannedQty?: number
  priority?: string
  assignedTo?: string
  startDate?: Date
  dueDate?: Date
  estimatedHours?: number
  plannedLaborCost?: number
  plannedOverheadCost?: number
  plannedMachineCost?: number
  plannedSubcontractCost?: number
  plannedWasteValue?: number
  items?: {
    description: string
    quantity: number
    unit?: string
    unitPrice?: number
    itemId?: string
  }[]
}) {
  const { organization } = await requireModuleAccess("workOrder")
  if (!organization || organization.id !== data.organizationId) {
    throw new Error("Unauthorized")
  }
  await ensureWorkOrderHppSchema()

  const plannedMaterialCost = (data.items || []).reduce(
    (sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0),
    0,
  )

  const plannedLaborCost = data.plannedLaborCost || 0
  const plannedOverheadCost = data.plannedOverheadCost || 0
  const plannedMachineCost = data.plannedMachineCost || 0
  const plannedSubcontractCost = data.plannedSubcontractCost || 0
  const plannedWasteValue = data.plannedWasteValue || 0

  const plannedTotalCost =
    plannedMaterialCost +
    plannedLaborCost +
    plannedOverheadCost +
    plannedMachineCost +
    plannedSubcontractCost -
    plannedWasteValue

  const workOrder = await prisma.$transaction(async (tx) => {
    const created = await tx.workOrder.create({
      data: {
        organizationId: data.organizationId,
        code: data.code,
        barcode: data.barcode,
        title: data.title,
        description: data.description,
        customerId: data.customerId,
        productItemId: data.productItemId,
        bomId: data.bomId,
        plannedQty: data.plannedQty || 0,
        priority: data.priority || "MEDIUM",
        assignedTo: data.assignedTo,
        startDate: data.startDate,
        dueDate: data.dueDate,
        estimatedHours: data.estimatedHours,
        plannedMaterialCost,
        plannedLaborCost,
        plannedOverheadCost,
        plannedMachineCost,
        plannedSubcontractCost,
        plannedWasteValue,
        plannedTotalCost,
        status: "DRAFT",
      },
    })

    if (data.items && data.items.length > 0) {
      await tx.workOrderItem.createMany({
        data: data.items.map((item) => ({
          workOrderId: created.id,
          itemId: item.itemId,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice || 0,
          totalPrice: (item.quantity || 0) * (item.unitPrice || 0),
        })),
      })
    }

    return created
  })

  revalidatePath("/work-order")
  return workOrder
}

export async function releaseWorkOrderFromBom(workOrderId: string, bomId: string, plannedQty: number) {
  const { organization } = await requireModuleAccess("workOrder")
  await ensureWorkOrderHppSchema()

  const safePlannedQty = Number(plannedQty || 0)
  if (safePlannedQty <= 0) {
    throw new Error("Planned qty harus lebih dari 0.")
  }

  const workOrder = await prisma.workOrder.findFirst({
    where: { id: workOrderId, organizationId: organization.id },
  })

  if (!workOrder) {
    throw new Error("Work order tidak ditemukan.")
  }

  if (!["DRAFT", "PENDING"].includes(workOrder.status)) {
    throw new Error("Hanya work order status DRAFT/PENDING yang bisa di-release.")
  }

  const bom = await prisma.billOfMaterial.findFirst({
    where: { id: bomId, organizationId: organization.id, isActive: true },
    include: {
      lines: {
        include: {
          componentItem: {
            select: { id: true, code: true, name: true, unit: true, unitCost: true },
          },
        },
        orderBy: { sequence: "asc" },
      },
    },
  })

  if (!bom) {
    throw new Error("BOM tidak ditemukan atau tidak aktif.")
  }

  await validateNoCircularBomDependency({
    organizationId: organization.id,
    bomId: bom.id,
    productItemId: bom.productItemId,
    componentItemIds: bom.lines.map((line) => line.componentItemId),
  })

  const plannedRows = bom.lines.map((line) => {
    const plannedComponentQty = safePlannedQty * line.quantityPerUnit * (1 + (line.scrapPercent || 0) / 100)
    const unitCost = line.componentItem.unitCost || 0
    const totalCost = plannedComponentQty * unitCost
    return {
      itemId: line.componentItemId,
      description: `${line.componentItem.code} - ${line.componentItem.name}`,
      quantity: plannedComponentQty,
      unit: line.uom || line.componentItem.unit,
      unitPrice: unitCost,
      totalPrice: totalCost,
    }
  })

  const plannedMaterialCost = plannedRows.reduce((sum, row) => sum + row.totalPrice, 0)

  await prisma.$transaction(async (tx) => {
    await tx.workOrderItem.deleteMany({ where: { workOrderId: workOrder.id } })

    if (plannedRows.length > 0) {
      await tx.workOrderItem.createMany({
        data: plannedRows.map((row) => ({
          workOrderId: workOrder.id,
          itemId: row.itemId,
          description: row.description,
          quantity: row.quantity,
          unit: row.unit,
          unitPrice: row.unitPrice,
          totalPrice: row.totalPrice,
        })),
      })
    }

    const plannedTotalCost =
      plannedMaterialCost +
      (workOrder.plannedLaborCost || 0) +
      (workOrder.plannedOverheadCost || 0) +
      (workOrder.plannedMachineCost || 0) +
      (workOrder.plannedSubcontractCost || 0) -
      (workOrder.plannedWasteValue || 0)

    await tx.workOrder.update({
      where: { id: workOrder.id },
      data: {
        bomId: bom.id,
        productItemId: bom.productItemId,
        plannedQty: safePlannedQty,
        plannedMaterialCost,
        plannedTotalCost,
        status: "RELEASED",
      },
    })
  })

  revalidatePath("/work-order")
  return { success: true }
}

export async function previewBomExplosion(input: {
  bomId: string
  plannedQty: number
  mode?: "single-level" | "multi-level"
  maxDepth?: number
}) {
  const { organization } = await requireModuleAccess("workOrder")
  await ensureWorkOrderHppSchema()

  const mode = input.mode || "multi-level"
  const explosion = await explodeBom({
    organizationId: organization.id,
    bomId: input.bomId,
    plannedQty: input.plannedQty,
    mode,
    maxDepth: input.maxDepth || 10,
  })

  return explosion
}

export async function generateWorkOrderChain(input: {
  workOrderId: string
  bomId: string
  plannedQty: number
  maxLevels?: number
}) {
  const { organization } = await requireModuleAccess("workOrder")
  await ensureWorkOrderHppSchema()

  const plannedQty = Number(input.plannedQty || 0)
  if (plannedQty <= 0) {
    throw new Error("Planned qty harus lebih dari 0.")
  }

  const parentWorkOrder = await prisma.workOrder.findFirst({
    where: { id: input.workOrderId, organizationId: organization.id },
  })

  if (!parentWorkOrder) {
    throw new Error("Work order parent tidak ditemukan.")
  }

  const maxLevels = Math.max(1, Number(input.maxLevels || 5))
  const skipped: Array<{ itemId: string; reason: string; parentWorkOrderId?: string }> = []
  const createdRows: Array<{ itemId: string; workOrderId: string; code: string; plannedQty: number; level: number; parentWorkOrderId: string }> = []
  const reusedRows: Array<{ itemId: string; workOrderId: string; code: string; plannedQty: number; level: number; parentWorkOrderId: string }> = []

  type QueueNode = {
    parentWorkOrderId: string
    parentCode: string
    parentPriority: string
    bomId: string
    plannedQty: number
    level: number
  }

  const queue: QueueNode[] = [{
    parentWorkOrderId: parentWorkOrder.id,
    parentCode: parentWorkOrder.code,
    parentPriority: parentWorkOrder.priority || "MEDIUM",
    bomId: input.bomId,
    plannedQty,
    level: 0,
  }]

  const processed = new Set<string>()
  const nextCodeSeqByParent = new Map<string, number>()

  await prisma.$transaction(async (tx) => {
    while (queue.length > 0) {
      const node = queue.shift()!
      const nodeKey = `${node.parentWorkOrderId}:${node.bomId}:${node.level}:${node.plannedQty.toFixed(6)}`
      if (processed.has(nodeKey)) continue
      processed.add(nodeKey)

      if (node.level >= maxLevels) {
        skipped.push({
          itemId: "",
          reason: `Melebihi batas max levels (${maxLevels}).`,
          parentWorkOrderId: node.parentWorkOrderId,
        })
        continue
      }

      const explosion = await explodeBom({
        organizationId: organization.id,
        bomId: node.bomId,
        plannedQty: node.plannedQty,
        mode: "single-level",
        maxDepth: 2,
      })

      const reqMap = new Map<string, { qty: number; level: number }>()
      for (const line of explosion.lines) {
        if (line.itemType !== "SEMI_FINISHED") continue
        const current = reqMap.get(line.itemId)
        if (!current) {
          reqMap.set(line.itemId, { qty: line.quantity, level: node.level + 1 })
        } else {
          current.qty += line.quantity
          reqMap.set(line.itemId, current)
        }
      }

      if (reqMap.size === 0) {
        continue
      }

      for (const [componentItemId, req] of reqMap.entries()) {
        const existingLink = await tx.$queryRawUnsafe<Array<{
          childWorkOrderId: string
          childCode: string
          childPlannedQty: number
          childBomId: string | null
        }>>(
          `
            SELECT
              l."childWorkOrderId",
              child."code" AS "childCode",
              child."plannedQty" AS "childPlannedQty",
              child."bomId" AS "childBomId"
            FROM "WorkOrderChainLink" l
            INNER JOIN "WorkOrder" child ON child."id" = l."childWorkOrderId"
            WHERE l."organizationId" = $1
              AND l."parentWorkOrderId" = $2
              AND l."componentItemId" = $3
            ORDER BY child."createdAt" ASC
            LIMIT 1
          `,
          organization.id,
          node.parentWorkOrderId,
          componentItemId,
        )

        if (existingLink.length > 0) {
          const reused = existingLink[0]
          reusedRows.push({
            itemId: componentItemId,
            workOrderId: reused.childWorkOrderId,
            code: reused.childCode,
            plannedQty: reused.childPlannedQty || req.qty,
            level: req.level,
            parentWorkOrderId: node.parentWorkOrderId,
          })

          if (reused.childBomId) {
            const childWo = await tx.workOrder.findUnique({
              where: { id: reused.childWorkOrderId },
              select: { id: true, code: true, priority: true, plannedQty: true, bomId: true },
            })
            if (childWo?.bomId) {
              queue.push({
                parentWorkOrderId: childWo.id,
                parentCode: childWo.code,
                parentPriority: childWo.priority || node.parentPriority,
                bomId: childWo.bomId,
                plannedQty: childWo.plannedQty || req.qty,
                level: req.level,
              })
            }
          }
          continue
        }

        const item = await tx.inventoryItem.findFirst({
          where: { id: componentItemId, organizationId: organization.id },
          select: { id: true, code: true, name: true },
        })

        if (!item) {
          skipped.push({
            itemId: componentItemId,
            reason: "Item semi-finished tidak ditemukan.",
            parentWorkOrderId: node.parentWorkOrderId,
          })
          continue
        }

        const componentBom = await tx.billOfMaterial.findFirst({
          where: {
            organizationId: organization.id,
            isActive: true,
            productItemId: componentItemId,
          },
          include: {
            lines: {
              include: {
                componentItem: {
                  select: { id: true, code: true, name: true, unit: true, unitCost: true },
                },
              },
              orderBy: { sequence: "asc" },
            },
          },
          orderBy: { version: "desc" },
        })

        let nextSeq = nextCodeSeqByParent.get(node.parentCode) || 1
        let candidateCode = buildNextAutoWorkOrderCode(node.parentCode, nextSeq)
        while (await tx.workOrder.findFirst({ where: { organizationId: organization.id, code: candidateCode }, select: { id: true } })) {
          nextSeq += 1
          candidateCode = buildNextAutoWorkOrderCode(node.parentCode, nextSeq)
        }
        nextCodeSeqByParent.set(node.parentCode, nextSeq + 1)

        const createdChild = await tx.workOrder.create({
          data: {
            organizationId: organization.id,
            code: candidateCode,
            title: `Auto WO Semi-Finished ${item.code}`,
            description: `Auto-generated dari WO ${node.parentCode}`,
            productItemId: componentItemId,
            bomId: componentBom?.id,
            plannedQty: req.qty,
            status: "DRAFT",
            priority: node.parentPriority || "MEDIUM",
            plannedMaterialCost: 0,
            plannedTotalCost: 0,
          },
        })

        if (componentBom && componentBom.lines.length > 0) {
          const plannedRows = componentBom.lines.map((line) => {
            const plannedComponentQty = req.qty * line.quantityPerUnit * (1 + (line.scrapPercent || 0) / 100)
            const unitCost = line.componentItem.unitCost || 0
            const totalCost = plannedComponentQty * unitCost
            return {
              itemId: line.componentItemId,
              description: `${line.componentItem.code} - ${line.componentItem.name}`,
              quantity: plannedComponentQty,
              unit: line.uom || line.componentItem.unit,
              unitPrice: unitCost,
              totalPrice: totalCost,
            }
          })

          const plannedMaterialCost = plannedRows.reduce((sum, row) => sum + row.totalPrice, 0)

          await tx.workOrderItem.createMany({
            data: plannedRows.map((row) => ({
              workOrderId: createdChild.id,
              itemId: row.itemId,
              description: row.description,
              quantity: row.quantity,
              unit: row.unit,
              unitPrice: row.unitPrice,
              totalPrice: row.totalPrice,
            })),
          })

          await tx.workOrder.update({
            where: { id: createdChild.id },
            data: {
              plannedMaterialCost,
              plannedTotalCost: plannedMaterialCost,
            },
          })
        }

        await tx.$executeRawUnsafe(
          `
            INSERT INTO "WorkOrderChainLink"
              ("organizationId", "parentWorkOrderId", "childWorkOrderId", "componentItemId", "requiredQty", "generationLevel")
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT ("parentWorkOrderId", "childWorkOrderId", "componentItemId") DO NOTHING
          `,
          organization.id,
          node.parentWorkOrderId,
          createdChild.id,
          componentItemId,
          req.qty,
          req.level,
        )

        createdRows.push({
          itemId: componentItemId,
          workOrderId: createdChild.id,
          code: createdChild.code,
          plannedQty: req.qty,
          level: req.level,
          parentWorkOrderId: node.parentWorkOrderId,
        })

        if (createdChild.bomId) {
          queue.push({
            parentWorkOrderId: createdChild.id,
            parentCode: createdChild.code,
            parentPriority: createdChild.priority || node.parentPriority,
            bomId: createdChild.bomId,
            plannedQty: createdChild.plannedQty || req.qty,
            level: req.level,
          })
        }
      }
    }
  })

  revalidatePath("/work-order")
  return {
    created: createdRows.length,
    reused: reusedRows.length,
    skipped: skipped.length,
    rows: createdRows,
    reusedRows,
    skippedRows: skipped,
    maxLevels,
  }
}

export async function validateBomDraftCircular(input: {
  bomId?: string
  productItemId: string
  componentItemIds: string[]
}) {
  const { organization } = await requireModuleAccess("workOrder")
  await ensureWorkOrderHppSchema()

  await validateNoCircularBomDependency({
    organizationId: organization.id,
    bomId: input.bomId,
    productItemId: input.productItemId,
    componentItemIds: input.componentItemIds,
  })

  return { valid: true }
}

export async function issueWorkOrderMaterial(input: {
  workOrderId: string
  itemId: string
  issuedQty: number
  notes?: string
}) {
  const { organization, user } = await requireModuleAccess("workOrder")
  await ensureWorkOrderHppSchema()

  const issuedQty = Number(input.issuedQty || 0)
  if (issuedQty <= 0) {
    throw new Error("Qty issue harus lebih dari 0.")
  }

  const workOrder = await prisma.workOrder.findFirst({
    where: { id: input.workOrderId, organizationId: organization.id },
    include: { items: true },
  })

  if (!workOrder) {
    throw new Error("Work order tidak ditemukan.")
  }

  if (!["RELEASED", "IN_PROGRESS"].includes(workOrder.status)) {
    throw new Error("Work order harus status RELEASED/IN_PROGRESS untuk issue material.")
  }

  const item = await prisma.inventoryItem.findFirst({
    where: { id: input.itemId, organizationId: organization.id },
  })

  if (!item) {
    throw new Error("Item inventory tidak ditemukan.")
  }
  const plannedRow = workOrder.items.find((row) => row.itemId === input.itemId)

  await prisma.$transaction(async (tx) => {
    const movement = await postInventoryMovementInTx(tx, {
      organizationId: organization.id,
      itemId: item.id,
      movementType: "OUT",
      quantity: issuedQty,
      reference: workOrder.code,
      description: `Issue material untuk WO ${workOrder.code}`,
      performedBy: user.id,
    })

    const movementUnitCost = Number(movement.unitCost ?? 0)
    const movementTotalCost = Number(movement.totalCost ?? 0)

    await postWorkOrderIssueMaterialJournalInTx(tx, {
      organizationId: organization.id,
      workOrderCode: workOrder.code,
      amount: movementTotalCost,
    })

    await tx.workOrderMaterialIssue.create({
      data: {
        workOrderId: workOrder.id,
        itemId: item.id,
        plannedQty: plannedRow?.quantity || 0,
        issuedQty,
        unitCost: movementUnitCost,
        totalCost: movementTotalCost,
        movementId: movement.id,
        notes: input.notes,
      },
    })

    const actualMaterialCost = (workOrder.actualMaterialCost || 0) + movementTotalCost
    const actualTotalCost = buildActualTotalCost({
      actualMaterialCost,
      actualLaborCost: workOrder.actualLaborCost || 0,
      actualOverheadCost: workOrder.actualOverheadCost || 0,
      actualMachineCost: workOrder.actualMachineCost || 0,
      actualSubcontractCost: workOrder.actualSubcontractCost || 0,
      actualWasteValue: workOrder.actualWasteValue || 0,
    })

    await tx.workOrder.update({
      where: { id: workOrder.id },
      data: {
        actualMaterialCost,
        actualTotalCost,
        status: workOrder.status === "RELEASED" ? "IN_PROGRESS" : workOrder.status,
      },
    })
  })

  revalidatePath("/work-order")
  revalidatePath("/inventory")

  return { success: true }
}

export async function addWorkOrderCostEntry(input: {
  workOrderId: string
  costType: WorkOrderCostType
  amount: number
  reference?: string
  description?: string
  entryDate?: Date
}) {
  const { organization } = await requireModuleAccess("workOrder")
  await ensureWorkOrderHppSchema()

  const amount = Number(input.amount || 0)
  if (amount <= 0) {
    throw new Error("Amount biaya harus lebih dari 0.")
  }

  const workOrder = await prisma.workOrder.findFirst({
    where: { id: input.workOrderId, organizationId: organization.id },
  })

  if (!workOrder) {
    throw new Error("Work order tidak ditemukan.")
  }

  await prisma.$transaction(async (tx) => {
    await tx.workOrderCostEntry.create({
      data: {
        workOrderId: workOrder.id,
        costType: input.costType,
        amount,
        reference: input.reference,
        description: input.description,
        entryDate: input.entryDate || new Date(),
      },
    })

    const data: Prisma.WorkOrderUpdateInput = {}

    if (input.costType === "WASTE") {
      data.actualWasteValue = (workOrder.actualWasteValue || 0) + amount
    } else {
      const field = ACTUAL_COST_FIELDS[input.costType]
      data[field] = (workOrder[field as keyof typeof workOrder] as number || 0) + amount
    }

    const nextActualMaterialCost = workOrder.actualMaterialCost || 0
    const nextActualLaborCost = input.costType === "LABOR" ? (workOrder.actualLaborCost || 0) + amount : workOrder.actualLaborCost || 0
    const nextActualOverheadCost = input.costType === "OVERHEAD" ? (workOrder.actualOverheadCost || 0) + amount : workOrder.actualOverheadCost || 0
    const nextActualMachineCost = input.costType === "MACHINE" ? (workOrder.actualMachineCost || 0) + amount : workOrder.actualMachineCost || 0
    const nextActualSubcontractCost = input.costType === "SUBCONTRACT" ? (workOrder.actualSubcontractCost || 0) + amount : workOrder.actualSubcontractCost || 0
    const nextActualWasteValue = input.costType === "WASTE" ? (workOrder.actualWasteValue || 0) + amount : workOrder.actualWasteValue || 0

    data.actualTotalCost = buildActualTotalCost({
      actualMaterialCost: nextActualMaterialCost,
      actualLaborCost: nextActualLaborCost,
      actualOverheadCost: nextActualOverheadCost,
      actualMachineCost: nextActualMachineCost,
      actualSubcontractCost: nextActualSubcontractCost,
      actualWasteValue: nextActualWasteValue,
    })

    await tx.workOrder.update({
      where: { id: workOrder.id },
      data,
    })
  })

  revalidatePath("/work-order")
  return { success: true }
}

export async function completeWorkOrder(workOrderId: string, actualQty: number) {
  const { organization, user } = await requireModuleAccess("workOrder")
  await ensureWorkOrderHppSchema()

  const safeActualQty = Number(actualQty || 0)
  if (safeActualQty <= 0) {
    throw new Error("Actual qty harus lebih dari 0.")
  }

  const workOrder = await prisma.workOrder.findFirst({
    where: { id: workOrderId, organizationId: organization.id },
    include: {
      productItem: true,
    },
  })

  if (!workOrder) {
    throw new Error("Work order tidak ditemukan.")
  }

  if (!workOrder.productItemId || !workOrder.productItem) {
    throw new Error("Work order belum memiliki produk jadi (product item).")
  }

  if (!["RELEASED", "IN_PROGRESS", "PENDING", "DRAFT"].includes(workOrder.status)) {
    throw new Error("Status work order tidak bisa diselesaikan.")
  }

  const actualTotalCost = buildActualTotalCost({
    actualMaterialCost: workOrder.actualMaterialCost || 0,
    actualLaborCost: workOrder.actualLaborCost || 0,
    actualOverheadCost: workOrder.actualOverheadCost || 0,
    actualMachineCost: workOrder.actualMachineCost || 0,
    actualSubcontractCost: workOrder.actualSubcontractCost || 0,
    actualWasteValue: workOrder.actualWasteValue || 0,
  })

  const hppPerUnit = safeActualQty > 0 ? actualTotalCost / safeActualQty : 0
  const varianceAmount = actualTotalCost - (workOrder.plannedTotalCost || 0)
  const variancePercent =
    (workOrder.plannedTotalCost || 0) > 0 ? (varianceAmount / (workOrder.plannedTotalCost || 1)) * 100 : 0

  await prisma.$transaction(async (tx) => {
    await postInventoryMovementInTx(tx, {
      organizationId: organization.id,
      itemId: workOrder.productItemId!,
      movementType: "IN",
      quantity: safeActualQty,
      unitCost: hppPerUnit,
      reference: workOrder.code,
      description: `Hasil produksi WO ${workOrder.code}`,
      performedBy: user.id,
    })

    await postWorkOrderCompleteJournalInTx(tx, {
      organizationId: organization.id,
      workOrderCode: workOrder.code,
      amount: actualTotalCost,
    })

    await tx.workOrder.update({
      where: { id: workOrder.id },
      data: {
        actualQty: safeActualQty,
        actualTotalCost,
        hppPerUnit,
        varianceAmount,
        variancePercent,
        status: "COMPLETED",
        completedAt: new Date(),
      },
    })
  })

  revalidatePath("/work-order")
  revalidatePath("/inventory")

  return { success: true }
}

export async function updateWorkOrderStatus(id: string, status: string) {
  const { organization } = await requireModuleAccess("workOrder")

  if (!ALLOWED_WORK_ORDER_STATUSES.has(status)) {
    throw new Error("Status work order tidak valid.")
  }

  const workOrder = await prisma.workOrder.findFirst({
    where: {
      id,
      organizationId: organization.id,
    },
  })

  if (!workOrder) {
    throw new Error("Work order tidak ditemukan atau bukan milik organisasi aktif.")
  }

  const updateData: { status: string; completedAt?: Date | null } = { status }
  if (status === "COMPLETED" && !workOrder.completedAt) {
    updateData.completedAt = new Date()
  }
  if (status !== "COMPLETED" && workOrder.completedAt) {
    updateData.completedAt = null
  }

  const updated = await prisma.workOrder.update({
    where: { id },
    data: updateData,
  })

  revalidatePath("/work-order")
  return updated
}

export async function getWarehouses(organizationId: string) {
  const { organization } = await requireCurrentOrganization()
  if (!organization || organization.id !== organizationId) {
    throw new Error("Unauthorized")
  }

  const warehouses = await prisma.warehouse.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
    },
    include: {
      manager: {
        select: { id: true, name: true },
      },
    },
    orderBy: { code: "asc" },
  })

  return warehouses
}

export async function createWarehouse(data: {
  organizationId: string
  code: string
  name: string
  location?: string
  type?: string
  managerId?: string
}) {
  const { organization } = await requireWritableCurrentOrganization()
  if (!organization || organization.id !== data.organizationId) {
    throw new Error("Unauthorized")
  }

  const warehouse = await prisma.warehouse.create({
    data: {
      organizationId: data.organizationId,
      code: data.code,
      name: data.name,
      location: data.location,
      type: data.type || "MAIN",
      managerId: data.managerId,
    },
  })

  revalidatePath("/inventory")
  return warehouse
}
