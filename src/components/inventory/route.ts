import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCurrentOrganization, requireWritableCurrentOrganization } from "@/lib/auth"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get("organizationId")

    if (!organizationId) {
      return NextResponse.json({ error: "Parameter organizationId wajib diisi" }, { status: 400 })
    }

    const { organization } = await requireCurrentOrganization()
    if (!organization || organization.id !== organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const items = await prisma.inventoryItem.findMany({
      where: { organizationId },
      include: {
        warehouse: { select: { id: true, name: true } }
      },
      orderBy: { code: 'asc' }
    })

    return NextResponse.json({ success: true, data: items })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { organizationId, warehouseId, code, name, unit, unitCost, barcode } = body

    if (!organizationId || !warehouseId || !code || !name) {
      return NextResponse.json({ error: "organizationId, warehouseId, code, dan name wajib diisi" }, { status: 400 })
    }

    const { organization } = await requireWritableCurrentOrganization()
    if (!organization || organization.id !== organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const item = await prisma.inventoryItem.create({
      data: {
        organizationId, warehouseId, code, name, unit: unit || "PCS", 
        unitCost: Number(unitCost) || 0, barcode, quantity: 0, totalValue: 0
      }
    })

    return NextResponse.json({ success: true, data: item })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}