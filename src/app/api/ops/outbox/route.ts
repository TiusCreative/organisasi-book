import { NextResponse } from "next/server"
import { getOutboxMetrics, publishPendingOutboxEvents } from "@/lib/outbox"

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

export async function GET(request: Request) {
  try {
    requireOpsSecret(request)
    const metrics = await getOutboxMetrics()
    return NextResponse.json({ ok: true, metrics })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ ok: false, error: message }, { status: message === "Unauthorized" ? 401 : 400 })
  }
}

export async function POST(request: Request) {
  try {
    requireOpsSecret(request)
    const url = new URL(request.url)
    const batchSize = url.searchParams.get("batchSize")
    const result = await publishPendingOutboxEvents({ batchSize: batchSize ? Number(batchSize) : undefined })
    const metrics = await getOutboxMetrics()
    return NextResponse.json({ ok: true, result, metrics })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ ok: false, error: message }, { status: message === "Unauthorized" ? 401 : 400 })
  }
}

