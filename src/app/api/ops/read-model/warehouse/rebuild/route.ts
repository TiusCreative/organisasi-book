import { NextResponse } from "next/server"
import { rebuildWarehouseReadModels } from "@/lib/warehouse-read-model"

export const dynamic = "force-dynamic"

function requireOpsSecret(request: Request) {
  const expected = process.env.OPS_SECRET
  if (!expected) {
    throw new Error("OPS_SECRET belum diset")
  }
  const provided = request.headers.get("x-ops-secret") || ""
  if (provided !== expected) {
    throw new Error("Unauthorized")
  }
}

export async function POST(request: Request) {
  try {
    requireOpsSecret(request)
    const body = (await request.json().catch(() => null)) as { organizationId?: string } | null
    await rebuildWarehouseReadModels({ organizationId: body?.organizationId })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ ok: false, error: message }, { status: message === "Unauthorized" ? 401 : 400 })
  }
}

