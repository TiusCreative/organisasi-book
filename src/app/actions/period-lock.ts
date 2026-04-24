"use server"

import { prisma } from "@/lib/prisma"
import { requireWritableModuleAccess, requireModuleAccess } from "@/lib/auth"
import { revalidatePath } from "next/cache"

export async function getPeriodLocks() {
  try {
    const { organization } = await requireModuleAccess("accounting" as any)
    const locks = await prisma.periodLock.findMany({
      where: { organizationId: organization.id },
      orderBy: [{ year: "desc" }, { month: "desc" }]
    })
    return { success: true, locks }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function lockPeriod(formData: FormData) {
  try {
    // Hanya ADMIN/MANAGER Akuntansi yang boleh tutup buku
    const { organization, user } = await requireWritableModuleAccess("accounting" as any)
    
    const year = parseInt(formData.get("year") as string)
    const month = parseInt(formData.get("month") as string)
    const reason = formData.get("reason") as string

    const lock = await prisma.periodLock.upsert({
      where: {
        organizationId_year_month: { organizationId: organization.id, year, month }
      },
      update: {
        isLocked: true,
        lockedAt: new Date(),
        lockedBy: user.id,
        lockedByName: user.name,
        reason
      },
      create: {
        organizationId: organization.id,
        year,
        month,
        isLocked: true,
        lockedBy: user.id,
        lockedByName: user.name,
        reason
      }
    })

    revalidatePath(`/organization/${organization.id}/accounting/period-lock`)
    return { success: true, lock }
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal mengunci periode." }
  }
}