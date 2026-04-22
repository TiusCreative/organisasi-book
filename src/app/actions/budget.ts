"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requireCurrentOrganization } from "@/lib/auth"
import { hasModulePermission } from "@/lib/permissions"

async function generateNextBudgetCode(tx: any, orgId: string, year: number) {
  const existingBudgets = await tx.budget.findMany({
    where: { organizationId: orgId, year },
    select: { code: true },
    orderBy: { code: 'desc' },
    take: 1
  })

  if (existingBudgets.length === 0) {
    return `BUD-${year}-001`
  }

  const lastCode = existingBudgets[0].code
  const lastNumber = parseInt(lastCode.split("-")[2])
  const nextNumber = lastNumber + 1
  return `BUD-${year}-${String(nextNumber).padStart(3, '0')}`
}

export async function getBudgets() {
  const { organization } = await requireCurrentOrganization()
  
  return await prisma.budget.findMany({
    where: { organizationId: organization.id },
    include: {
      division: {
        select: { id: true, code: true, name: true }
      },
      approver: {
        select: { id: true, name: true, email: true }
      },
      items: {
        include: {
          account: {
            select: { id: true, code: true, name: true }
          }
        }
      },
      _count: {
        select: { items: true }
      }
    },
    orderBy: [{ year: 'desc' }, { createdAt: 'desc' }]
  })
}

export async function createBudget(formData: FormData) {
  const { user, organization } = await requireCurrentOrganization()

  if (!hasModulePermission(user, "reports")) {
    throw new Error("Anda tidak memiliki izin untuk membuat budget")
  }

  const year = parseInt(formData.get("year") as string)
  const divisionId = formData.get("divisionId") as string || null
  const name = formData.get("name") as string
  const periodType = formData.get("periodType") as string || "ANNUAL"
  const totalBudget = parseFloat((formData.get("totalBudget") as string) || "0")
  const notes = formData.get("notes") as string

  if (!year || !name) {
    throw new Error("Tahun dan nama budget wajib diisi")
  }

  await prisma.$transaction(async (tx) => {
    const code = await generateNextBudgetCode(tx, organization.id, year)

    await tx.budget.create({
      data: {
        organizationId: organization.id,
        code,
        year,
        divisionId,
        name,
        periodType,
        totalBudget,
        notes
      }
    })
  })

  revalidatePath("/budget")
  revalidatePath("/dashboard")
}

export async function updateBudget(formData: FormData) {
  const { user, organization } = await requireCurrentOrganization()

  if (!hasModulePermission(user, "reports")) {
    throw new Error("Anda tidak memiliki izin untuk mengedit budget")
  }

  const id = formData.get("id") as string
  const divisionId = formData.get("divisionId") as string || null
  const name = formData.get("name") as string
  const periodType = formData.get("periodType") as string
  const totalBudget = parseFloat((formData.get("totalBudget") as string) || "0")
  const status = formData.get("status") as string
  const notes = formData.get("notes") as string

  if (!id || !name) {
    throw new Error("Data tidak lengkap")
  }

  await prisma.budget.update({
    where: { id },
    data: {
      divisionId,
      name,
      periodType,
      totalBudget,
      status,
      notes
    }
  })

  revalidatePath("/budget")
  revalidatePath("/dashboard")
}

export async function approveBudget(id: string) {
  const { user } = await requireCurrentOrganization()

  if (!hasModulePermission(user, "organizationAdmin")) {
    throw new Error("Anda tidak memiliki izin untuk approve budget")
  }

  await prisma.budget.update({
    where: { id },
    data: {
      status: "APPROVED",
      approvedBy: user.id,
      approvedAt: new Date()
    }
  })

  revalidatePath("/budget")
}

export async function deleteBudget(id: string) {
  const { user } = await requireCurrentOrganization()

  if (!hasModulePermission(user, "organizationAdmin")) {
    throw new Error("Anda tidak memiliki izin untuk menghapus budget")
  }

  await prisma.budget.delete({
    where: { id }
  })

  revalidatePath("/budget")
}

export async function getBudgetReport(year: number) {
  const { organization } = await requireCurrentOrganization()
  
  const budgets = await prisma.budget.findMany({
    where: { organizationId: organization.id, year },
    include: {
      division: {
        select: { id: true, code: true, name: true }
      },
      items: {
        include: {
          actuals: true
        }
      }
    }
  })

  // Calculate actual totals from transactions
  const budgetsWithActuals = await Promise.all(budgets.map(async (budget) => {
    const totalActual = budget.items.reduce((sum, item) => {
      const itemActual = item.actuals.reduce((acc, actual) => acc + actual.actualAmount, 0)
      return sum + itemActual
    }, 0)

    const variance = totalActual - budget.totalBudget
    const variancePercent = budget.totalBudget > 0 ? (variance / budget.totalBudget) * 100 : 0

    return {
      ...budget,
      totalActual,
      variance,
      variancePercent
    }
  }))

  return budgetsWithActuals
}
