import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCurrentOrganization } from "@/lib/auth"
import { hasModulePermission } from "@/lib/permissions"

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export async function GET() {
  try {
    const { organization } = await requireCurrentOrganization()
    const customers = await prisma.customer.findMany({
      where: { organizationId: organization.id },
      orderBy: { name: "asc" },
    })
    return NextResponse.json({ success: true, customers })
  } catch (error) {
    console.error("GET /api/customers failed:", error)
    return jsonError("Gagal memuat customer.", 500)
  }
}

export async function POST(request: Request) {
  try {
    const { user, organization } = await requireCurrentOrganization()
    if (!hasModulePermission(user, "customer")) {
      return jsonError("Anda tidak memiliki izin menambah customer.", 403)
    }

    const body = await request.json()
    const name = (body?.name as string | undefined)?.trim()
    if (!name) {
      return jsonError("Nama customer wajib diisi.", 400)
    }

    const lastCustomer = await prisma.customer.findFirst({
      where: { organizationId: organization.id },
      orderBy: { code: "desc" },
    })
    const lastCodeNum = lastCustomer ? Number.parseInt(lastCustomer.code.split("-")[1] || "0", 10) : 0
    const code = `CUST-${String(lastCodeNum + 1).padStart(3, "0")}`

    const customer = await prisma.customer.create({
      data: {
        organizationId: organization.id,
        code,
        name,
        email: body?.email || null,
        phone: body?.phone || null,
        address: body?.address || null,
        city: body?.city || null,
        npwp: body?.npwp || null,
        creditLimit: Number(body?.creditLimit || 0),
        paymentTerm: Number(body?.paymentTerm || 30),
        notes: body?.notes || null,
      },
    })

    return NextResponse.json({ success: true, customer }, { status: 201 })
  } catch (error) {
    console.error("POST /api/customers failed:", error)
    return jsonError("Gagal menambah customer.", 400)
  }
}

export async function PUT(request: Request) {
  try {
    const { user, organization } = await requireCurrentOrganization()
    if (!hasModulePermission(user, "customer")) {
      return jsonError("Anda tidak memiliki izin mengubah customer.", 403)
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) {
      return jsonError("Parameter id wajib diisi.", 400)
    }

    const current = await prisma.customer.findFirst({
      where: { id, organizationId: organization.id },
    })
    if (!current) {
      return jsonError("Customer tidak ditemukan.", 404)
    }

    const body = await request.json()
    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name: (body?.name as string | undefined)?.trim() || current.name,
        email: body?.email ?? current.email,
        phone: body?.phone ?? current.phone,
        address: body?.address ?? current.address,
        city: body?.city ?? current.city,
        npwp: body?.npwp ?? current.npwp,
        creditLimit: body?.creditLimit !== undefined ? Number(body.creditLimit) : current.creditLimit,
        paymentTerm: body?.paymentTerm !== undefined ? Number(body.paymentTerm) : current.paymentTerm,
        status: body?.status ?? current.status,
        notes: body?.notes ?? current.notes,
      },
    })

    return NextResponse.json({ success: true, customer })
  } catch (error) {
    console.error("PUT /api/customers failed:", error)
    return jsonError("Gagal mengubah customer.", 400)
  }
}

export async function DELETE(request: Request) {
  try {
    const { user, organization } = await requireCurrentOrganization()
    if (user.role !== "ADMIN") {
      return jsonError("Hanya admin yang dapat menghapus customer.", 403)
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) {
      return jsonError("Parameter id wajib diisi.", 400)
    }

    const customer = await prisma.customer.findFirst({
      where: { id, organizationId: organization.id },
    })
    if (!customer) {
      return jsonError("Customer tidak ditemukan.", 404)
    }

    const invoiceCount = await prisma.invoice.count({ where: { customerId: id } })
    if (invoiceCount > 0) {
      return jsonError("Customer memiliki invoice aktif. Tidak dapat dihapus.", 409)
    }

    await prisma.customer.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/customers failed:", error)
    return jsonError("Gagal menghapus customer.", 400)
  }
}
