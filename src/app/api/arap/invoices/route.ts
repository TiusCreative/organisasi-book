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
      where.invoiceDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        customer: true,
        items: true,
      },
      orderBy: { invoiceDate: "desc" },
    })

    return NextResponse.json({ success: true, invoices })
  } catch (error) {
    console.error("Error fetching invoices:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch invoices" }, { status: 500 })
  }
}
