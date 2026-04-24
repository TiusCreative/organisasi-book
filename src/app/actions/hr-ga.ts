"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireWritableModuleAccess } from "@/lib/auth"

function parseOptionalTime(date: string, time: string) {
  const normalizedDate = String(date || "").trim()
  const normalizedTime = String(time || "").trim()
  if (!normalizedDate || !normalizedTime) return null
  const value = new Date(`${normalizedDate}T${normalizedTime}:00`)
  return Number.isNaN(value.getTime()) ? null : value
}

export async function upsertAttendanceRecord(formData: FormData) {
  const { organization } = await requireWritableModuleAccess("hrga")

  const employeeId = String(formData.get("employeeId") || "").trim()
  const date = String(formData.get("date") || "").trim()
  const checkInTime = String(formData.get("checkInTime") || "").trim()
  const checkOutTime = String(formData.get("checkOutTime") || "").trim()
  const overtimeMinutes = Math.max(0, Number(formData.get("overtimeMinutes") || "0"))
  const notes = String(formData.get("notes") || "").trim()

  if (!employeeId || !date) {
    return { success: false, error: "Karyawan dan tanggal wajib diisi." }
  }

  const baseDate = new Date(date)
  if (Number.isNaN(baseDate.getTime())) {
    return { success: false, error: "Tanggal tidak valid." }
  }

  const checkInAt = parseOptionalTime(date, checkInTime)
  const checkOutAt = parseOptionalTime(date, checkOutTime)

  await prisma.attendanceRecord.upsert({
    where: {
      employeeId_date: {
        employeeId,
        date: baseDate,
      },
    },
    create: {
      organizationId: organization.id,
      employeeId,
      date: baseDate,
      checkInAt,
      checkOutAt,
      overtimeMinutes: Number.isFinite(overtimeMinutes) ? Math.trunc(overtimeMinutes) : 0,
      notes: notes || null,
    },
    update: {
      checkInAt,
      checkOutAt,
      overtimeMinutes: Number.isFinite(overtimeMinutes) ? Math.trunc(overtimeMinutes) : 0,
      notes: notes || null,
    },
  })

  revalidatePath("/hr-ga/attendance")
  return { success: true }
}

export async function deleteAttendanceRecord(formData: FormData) {
  const { organization } = await requireWritableModuleAccess("hrga")
  const id = String(formData.get("id") || "").trim()
  if (!id) return { success: false, error: "ID tidak valid." }

  await prisma.attendanceRecord.deleteMany({
    where: { id, organizationId: organization.id },
  })

  revalidatePath("/hr-ga/attendance")
  return { success: true }
}

export async function createFacilityMaintenance(formData: FormData) {
  const { organization } = await requireWritableModuleAccess("hrga")

  const assetName = String(formData.get("assetName") || "").trim()
  const assetCategory = String(formData.get("assetCategory") || "").trim()
  const scheduledAtRaw = String(formData.get("scheduledAt") || "").trim()
  const estimatedCost = Math.max(0, Number(formData.get("estimatedCost") || "0"))
  const notes = String(formData.get("notes") || "").trim()

  if (!assetName || !scheduledAtRaw) {
    return { success: false, error: "Nama aset dan jadwal wajib diisi." }
  }

  const scheduledAt = new Date(scheduledAtRaw)
  if (Number.isNaN(scheduledAt.getTime())) {
    return { success: false, error: "Tanggal jadwal tidak valid." }
  }

  await prisma.facilityMaintenance.create({
    data: {
      organizationId: organization.id,
      assetName,
      assetCategory: assetCategory || null,
      scheduledAt,
      status: "PLANNED",
      estimatedCost: Number.isFinite(estimatedCost) ? estimatedCost : 0,
      actualCost: 0,
      notes: notes || null,
    },
  })

  revalidatePath("/hr-ga/maintenance")
  return { success: true }
}

export async function updateFacilityMaintenanceStatus(formData: FormData) {
  const { organization } = await requireWritableModuleAccess("hrga")

  const id = String(formData.get("id") || "").trim()
  const status = String(formData.get("status") || "").trim()

  if (!id || !["PLANNED", "DONE", "CANCELLED"].includes(status)) {
    return { success: false, error: "Data tidak valid." }
  }

  await prisma.facilityMaintenance.updateMany({
    where: { id, organizationId: organization.id },
    data: {
      status,
      completedAt: status === "DONE" ? new Date() : null,
    },
  })

  revalidatePath("/hr-ga/maintenance")
  return { success: true }
}

export async function deleteFacilityMaintenance(formData: FormData) {
  const { organization } = await requireWritableModuleAccess("hrga")
  const id = String(formData.get("id") || "").trim()
  if (!id) return { success: false, error: "ID tidak valid." }

  await prisma.facilityMaintenance.deleteMany({
    where: { id, organizationId: organization.id },
  })

  revalidatePath("/hr-ga/maintenance")
  return { success: true }
}
