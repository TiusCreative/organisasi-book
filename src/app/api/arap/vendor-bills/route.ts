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
      where.billDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    }

    const vendorBills = await prisma.vendorBill.findMany({
      where,
      include: {
        supplier: true,
        items: true,
      },
      orderBy: { billDate: "desc" },
    })

    return NextResponse.json({ success: true, vendorBills })
  } catch (error) {
    console.error("Error fetching vendor bills:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch vendor bills" }, { status: 500 })
  }
}
