"use server"

import { prisma } from "@/lib/prisma"
import { requireWritableModuleAccess, requireModuleAccess } from "@/lib/auth"
import { revalidatePath } from "next/cache"

export type AccountingMappingInput = {
  // Modul Penjualan
  salesAccountId?: string | null
  salesDiscountAccountId?: string | null
  salesReturnAccountId?: string | null
  
  // Modul Pajak
  ppnOutputAccountId?: string | null
  ppnInputAccountId?: string | null
  pph23PayableAccountId?: string | null
  
  // Modul Inventori & HPP
  inventoryAccountId?: string | null
  cogsAccountId?: string | null
}

/**
 * Memperbarui / Menyimpan konfigurasi pemetaan akun default (COA Mapping)
 */
export async function updateCoaMapping(data: AccountingMappingInput) {
  const { organization } = await requireWritableModuleAccess("accounting")

  try {
    // Catatan: Asumsi terdapat model AccountingConfig di schema.prisma
    // Relasi organizationId harus berstatus @unique
    const updatedConfig = await prisma.accountingConfig.upsert({
      where: {
        organizationId: organization.id
      },
      update: {
        salesAccountId: data.salesAccountId,
        salesDiscountAccountId: data.salesDiscountAccountId,
        salesReturnAccountId: data.salesReturnAccountId,
        ppnOutputAccountId: data.ppnOutputAccountId,
        ppnInputAccountId: data.ppnInputAccountId,
        pph23PayableAccountId: data.pph23PayableAccountId,
        inventoryAccountId: data.inventoryAccountId,
        cogsAccountId: data.cogsAccountId,
      },
      create: {
        organizationId: organization.id,
        salesAccountId: data.salesAccountId,
        salesDiscountAccountId: data.salesDiscountAccountId,
        salesReturnAccountId: data.salesReturnAccountId,
        ppnOutputAccountId: data.ppnOutputAccountId,
        ppnInputAccountId: data.ppnInputAccountId,
        pph23PayableAccountId: data.pph23PayableAccountId,
        inventoryAccountId: data.inventoryAccountId,
        cogsAccountId: data.cogsAccountId,
      }
    })

    revalidatePath("/pengaturan/akuntansi")
    return { success: true, data: updatedConfig }
  } catch (error: any) {
    console.error("Error updating COA Mapping:", error)
    return { success: false, error: "Gagal memperbarui pemetaan akun. Pastikan model AccountingConfig tersedia di Prisma Schema." }
  }
}

/**
 * Menarik data pemetaan akun saat ini beserta detail nama akunnya
 */
export async function getCoaMapping() {
  const { organization } = await requireModuleAccess("accounting")

  try {
    const config = await prisma.accountingConfig.findUnique({
      where: { organizationId: organization.id },
      // Include relasi ke ChartOfAccount agar FE bisa menampilkan Nama Akun, bukan hanya ID
      include: {
        salesAccount: { select: { id: true, code: true, name: true } },
        ppnOutputAccount: { select: { id: true, code: true, name: true } },
        ppnInputAccount: { select: { id: true, code: true, name: true } },
        inventoryAccount: { select: { id: true, code: true, name: true } },
        cogsAccount: { select: { id: true, code: true, name: true } },
      }
    })

    return { success: true, data: config }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}