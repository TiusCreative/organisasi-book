"use server"

import { prisma } from "@/lib/prisma"
import { requireCurrentOrganization } from "@/lib/auth"
import { revalidatePath } from "next/cache"

export async function getDocumentTemplate(type: string) {
  const { organization } = await requireCurrentOrganization()

  try {
    const template = await prisma.documentTemplate.findUnique({
      where: {
        organizationId_type: {
          organizationId: organization.id,
          type: type,
        }
      }
    })
    return { success: true, template }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function saveDocumentTemplate(data: { type: string; name: string; contentHtml: string }) {
  const { organization } = await requireCurrentOrganization()

  try {
    const template = await prisma.documentTemplate.upsert({
      where: {
        organizationId_type: {
          organizationId: organization.id,
          type: data.type,
        }
      },
      update: {
        name: data.name,
        contentHtml: data.contentHtml,
      },
      create: {
        organizationId: organization.id,
        type: data.type,
        name: data.name,
        contentHtml: data.contentHtml,
      }
    })
    return { success: true, template }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}