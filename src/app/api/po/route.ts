import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCurrentOrganization } from "@/lib/auth"

export async function GET(request: Request) {
  try {
    const { organization } = await requireCurrentOrganization()
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    const where: any = { organizationId: organization.id }
    if (startDate && endDate) {
      where.orderDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    }

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: true,
        items: true,
      },
      orderBy: { orderDate: "desc" },
    })

    return NextResponse.json({ success: true, purchaseOrders })
  } catch (error) {
    console.error("Error fetching purchase orders:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch purchase orders" }, { status: 500 })
  }
}
