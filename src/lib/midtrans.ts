import crypto from "node:crypto"

function getMidtransServerKey() {
  return process.env.MIDTRANS_SERVER_KEY || ""
}

export function isMidtransConfigured() {
  return Boolean(process.env.MIDTRANS_SERVER_KEY && process.env.MIDTRANS_CLIENT_KEY)
}

export function getMidtransClientKey() {
  return process.env.MIDTRANS_CLIENT_KEY || ""
}

export function getMidtransSnapBaseUrl() {
  return process.env.MIDTRANS_IS_PRODUCTION === "true"
    ? "https://app.midtrans.com"
    : "https://app.sandbox.midtrans.com"
}

export function getMidtransApiBaseUrl() {
  return process.env.MIDTRANS_IS_PRODUCTION === "true"
    ? "https://api.midtrans.com"
    : "https://api.sandbox.midtrans.com"
}

function createBasicAuthHeader() {
  const serverKey = getMidtransServerKey()
  const encoded = Buffer.from(`${serverKey}:`).toString("base64")
  return `Basic ${encoded}`
}

export async function getMidtransTransactionStatus(orderId: string) {
  if (!getMidtransServerKey()) {
    throw new Error("MIDTRANS_SERVER_KEY belum diatur.")
  }

  const response = await fetch(`${getMidtransApiBaseUrl()}/v2/${encodeURIComponent(orderId)}/status`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: createBasicAuthHeader(),
      "Content-Type": "application/json",
    },
    cache: "no-store",
  })

  const json = await response.json()
  if (!response.ok) {
    throw new Error(json?.status_message || "Gagal mengambil status transaksi Midtrans.")
  }

  return json as Record<string, unknown>
}

export async function createMidtransSnapTransaction(payload: Record<string, unknown>) {
  if (!getMidtransServerKey()) {
    throw new Error("MIDTRANS_SERVER_KEY belum diatur.")
  }

  const response = await fetch(`${getMidtransApiBaseUrl()}/snap/v1/transactions`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: createBasicAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  const json = await response.json()
  if (!response.ok) {
    throw new Error(json?.error_messages?.join(", ") || json?.status_message || "Gagal membuat transaksi Midtrans.")
  }

  return json as {
    token: string
    redirect_url: string
  }
}

export function verifyMidtransSignature(input: {
  orderId: string
  statusCode: string
  grossAmount: string
  signatureKey: string
}) {
  const raw = `${input.orderId}${input.statusCode}${input.grossAmount}${getMidtransServerKey()}`
  const expected = crypto.createHash("sha512").update(raw).digest("hex")
  return expected === input.signatureKey
}

export function mapMidtransTransactionStatus(status: string, fraudStatus?: string | null) {
  if (status === "capture") {
    return fraudStatus === "accept" || fraudStatus === "ACCEPT" ? "SETTLEMENT" : "PENDING"
  }

  if (status === "settlement") return "SETTLEMENT"
  if (status === "pending") return "PENDING"
  if (status === "expire") return "EXPIRE"
  if (status === "cancel") return "CANCEL"
  if (status === "deny") return "DENY"
  return status.toUpperCase()
}
