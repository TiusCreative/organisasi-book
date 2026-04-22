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
    const suppliers = await prisma.supplier.findMany({
      where: { organizationId: organization.id },
      orderBy: { name: "asc" },
    })
    return NextResponse.json({ success: true, suppliers })
  } catch (error) {
    console.error("GET /api/suppliers failed:", error)
    return jsonError("Gagal memuat supplier.", 500)
  }
}

export async function POST(request: Request) {
  try {
    const { user, organization } = await requireCurrentOrganization()
    if (!hasModulePermission(user, "supplier")) {
      return jsonError("Anda tidak memiliki izin menambah supplier.", 403)
    }

    const body = await request.json()
    const name = (body?.name as string | undefined)?.trim()
    if (!name) {
      return jsonError("Nama supplier wajib diisi.", 400)
    }

    const lastSupplier = await prisma.supplier.findFirst({
      where: { organizationId: organization.id },
      orderBy: { code: "desc" },
    })
    const lastCodeNum = lastSupplier ? Number.parseInt(lastSupplier.code.split("-")[1] || "0", 10) : 0
    const code = `SUPP-${String(lastCodeNum + 1).padStart(3, "0")}`

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: organization.id,
        code,
        name,
        email: body?.email || null,
        phone: body?.phone || null,
        address: body?.address || null,
        city: body?.city || null,
        npwp: body?.npwp || null,
        bankAccount: body?.bankAccount || null,
        bankName: body?.bankName || null,
        paymentTerm: Number(body?.paymentTerm || 30),
        notes: body?.notes || null,
      },
    })
    return NextResponse.json({ success: true, supplier }, { status: 201 })
  } catch (error) {
    console.error("POST /api/suppliers failed:", error)
    return jsonError("Gagal menambah supplier.", 400)
  }
}

export async function PUT(request: Request) {
  try {
    const { user, organization } = await requireCurrentOrganization()
    if (!hasModulePermission(user, "supplier")) {
      return jsonError("Anda tidak memiliki izin mengubah supplier.", 403)
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) {
      return jsonError("Parameter id wajib diisi.", 400)
    }

    const current = await prisma.supplier.findFirst({
      where: { id, organizationId: organization.id },
    })
    if (!current) {
      return jsonError("Supplier tidak ditemukan.", 404)
    }

    const body = await request.json()
    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        name: (body?.name as string | undefined)?.trim() || current.name,
        email: body?.email ?? current.email,
        phone: body?.phone ?? current.phone,
        address: body?.address ?? current.address,
        city: body?.city ?? current.city,
        npwp: body?.npwp ?? current.npwp,
        bankAccount: body?.bankAccount ?? current.bankAccount,
        bankName: body?.bankName ?? current.bankName,
        paymentTerm: body?.paymentTerm !== undefined ? Number(body.paymentTerm) : current.paymentTerm,
        status: body?.status ?? current.status,
        notes: body?.notes ?? current.notes,
      },
    })
    return NextResponse.json({ success: true, supplier })
  } catch (error) {
    console.error("PUT /api/suppliers failed:", error)
    return jsonError("Gagal mengubah supplier.", 400)
  }
}

export async function DELETE(request: Request) {
  try {
    const { user, organization } = await requireCurrentOrganization()
    if (user.role !== "ADMIN") {
      return jsonError("Hanya admin yang dapat menghapus supplier.", 403)
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) {
      return jsonError("Parameter id wajib diisi.", 400)
    }

    const supplier = await prisma.supplier.findFirst({
      where: { id, organizationId: organization.id },
    })
    if (!supplier) {
      return jsonError("Supplier tidak ditemukan.", 404)
    }

    const billCount = await prisma.vendorBill.count({ where: { supplierId: id } })
    if (billCount > 0) {
      return jsonError("Supplier memiliki vendor bill aktif. Tidak dapat dihapus.", 409)
    }

    await prisma.supplier.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/suppliers failed:", error)
    return jsonError("Gagal menghapus supplier.", 400)
  }
}
