import { prisma } from "@/lib/prisma"

export type BomExplodeMode = "single-level" | "multi-level"

export interface BomExplodedLine {
  itemId: string
  code: string
  name: string
  unit: string
  itemType?: string | null
  depth: number
  quantity: number
  unitCost: number
  totalCost: number
  parentItemId?: string
}

export interface BomExplosionResult {
  rootBomId: string
  rootProductItemId: string
  plannedQty: number
  mode: BomExplodeMode
  lines: BomExplodedLine[]
  totalMaterialCost: number
}

function chooseActiveBomByProduct<T extends { productItemId: string; version: number }>(boms: T[]) {
  const map = new Map<string, T>()
  for (const bom of boms) {
    const current = map.get(bom.productItemId)
    if (!current || bom.version > current.version) {
      map.set(bom.productItemId, bom)
    }
  }
  return map
}

function buildItemGraph(
  boms: Array<{ productItemId: string; lines: Array<{ componentItemId: string }> }>,
  override?: { productItemId: string; components: string[] },
) {
  const graph = new Map<string, Set<string>>()
  for (const bom of boms) {
    graph.set(
      bom.productItemId,
      new Set(bom.lines.map((line) => line.componentItemId)),
    )
  }

  if (override) {
    graph.set(override.productItemId, new Set(override.components))
  }

  return graph
}

function hasPathToTarget(graph: Map<string, Set<string>>, start: string, target: string) {
  if (start === target) return true
  const visited = new Set<string>()
  const stack = [start]

  while (stack.length > 0) {
    const node = stack.pop()!
    if (node === target) return true
    if (visited.has(node)) continue
    visited.add(node)
    const next = graph.get(node)
    if (!next) continue
    for (const child of next) {
      if (!visited.has(child)) stack.push(child)
    }
  }

  return false
}

export async function validateNoCircularBomDependency(input: {
  organizationId: string
  bomId?: string
  productItemId: string
  componentItemIds: string[]
}) {
  const activeBoms = await prisma.billOfMaterial.findMany({
    where: { organizationId: input.organizationId, isActive: true },
    select: {
      id: true,
      productItemId: true,
      lines: {
        select: { componentItemId: true },
      },
    },
  })

  const filtered = input.bomId ? activeBoms.filter((bom) => bom.id !== input.bomId) : activeBoms
  const graph = buildItemGraph(filtered, {
    productItemId: input.productItemId,
    components: input.componentItemIds,
  })

  for (const componentId of input.componentItemIds) {
    const circular = hasPathToTarget(graph, componentId, input.productItemId)
    if (circular) {
      throw new Error("Circular dependency BOM terdeteksi. Komponen menghasilkan loop ke produk.")
    }
  }
}

export async function explodeBom(input: {
  organizationId: string
  bomId: string
  plannedQty: number
  mode: BomExplodeMode
  maxDepth?: number
}) {
  const plannedQty = Number(input.plannedQty || 0)
  if (plannedQty <= 0) {
    throw new Error("Planned qty harus lebih dari 0.")
  }

  const rootBom = await prisma.billOfMaterial.findFirst({
    where: {
      id: input.bomId,
      organizationId: input.organizationId,
      isActive: true,
    },
    include: {
      lines: {
        include: {
          componentItem: {
            select: { id: true, code: true, name: true, unit: true, unitCost: true, itemType: true },
          },
        },
        orderBy: { sequence: "asc" },
      },
    },
  })

  if (!rootBom) {
    throw new Error("BOM tidak ditemukan atau tidak aktif.")
  }

  await validateNoCircularBomDependency({
    organizationId: input.organizationId,
    bomId: rootBom.id,
    productItemId: rootBom.productItemId,
    componentItemIds: rootBom.lines.map((line) => line.componentItemId),
  })

  const maxDepth = Math.max(1, Number(input.maxDepth || 10))
  const allActiveBoms = await prisma.billOfMaterial.findMany({
    where: { organizationId: input.organizationId, isActive: true },
    include: {
      lines: {
        include: {
          componentItem: {
            select: { id: true, code: true, name: true, unit: true, unitCost: true, itemType: true },
          },
        },
        orderBy: { sequence: "asc" },
      },
    },
  })

  const bomByProduct = chooseActiveBomByProduct(allActiveBoms)
  const resultLines: BomExplodedLine[] = []

  const walk = (
    bom: (typeof allActiveBoms)[number],
    baseQty: number,
    depth: number,
    parentItemId?: string,
    visitedProducts: Set<string> = new Set(),
  ) => {
    if (depth > maxDepth) {
      throw new Error(`Melebihi max depth (${maxDepth}) saat explode BOM.`)
    }
    if (visitedProducts.has(bom.productItemId)) {
      throw new Error("Circular dependency BOM terdeteksi saat explode.")
    }

    const nextVisited = new Set(visitedProducts)
    nextVisited.add(bom.productItemId)

    for (const line of bom.lines) {
      const qty = baseQty * line.quantityPerUnit * (1 + (line.scrapPercent || 0) / 100)
      const unitCost = line.componentItem.unitCost || 0
      const totalCost = qty * unitCost

      resultLines.push({
        itemId: line.componentItem.id,
        code: line.componentItem.code,
        name: line.componentItem.name,
        unit: line.uom || line.componentItem.unit,
        itemType: line.componentItem.itemType,
        depth,
        quantity: qty,
        unitCost,
        totalCost,
        parentItemId,
      })

      if (input.mode === "multi-level") {
        const childBom = bomByProduct.get(line.componentItemId)
        if (childBom) {
          walk(childBom, qty, depth + 1, bom.productItemId, nextVisited)
        }
      }
    }
  }

  walk(rootBom, plannedQty, 1)

  const totalMaterialCost = resultLines.reduce((sum, line) => sum + line.totalCost, 0)
  const explosion: BomExplosionResult = {
    rootBomId: rootBom.id,
    rootProductItemId: rootBom.productItemId,
    plannedQty,
    mode: input.mode,
    lines: resultLines,
    totalMaterialCost,
  }

  return explosion
}
