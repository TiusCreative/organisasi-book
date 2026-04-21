import { UserRole } from "@prisma/client"

export const SESSION_COOKIE = "orgbook_session"

function getAuthSecret() {
  return process.env.AUTH_SECRET || "dev-orgbook-secret-change-me"
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function base64ToBytes(base64: string) {
  const binary = atob(base64)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function encodeBase64Url(value: string) {
  return bytesToBase64(new TextEncoder().encode(value))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

function decodeBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=")
  return new TextDecoder().decode(base64ToBytes(padded))
}

async function importKey() {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getAuthSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  )
}

async function signValue(value: string) {
  const key = await importKey()
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))
  return bytesToBase64(new Uint8Array(signature))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

export async function createSessionToken(input: { userId: string; role: UserRole }) {
  const payload = JSON.stringify({
    userId: input.userId,
    role: input.role,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
  })
  const encodedPayload = encodeBase64Url(payload)
  const signature = await signValue(encodedPayload)
  return `${encodedPayload}.${signature}`
}

export async function verifySessionToken(token: string) {
  const [encodedPayload, signature] = token.split(".")
  if (!encodedPayload || !signature) {
    return null
  }

  const expectedSignature = await signValue(encodedPayload)
  if (expectedSignature !== signature) {
    return null
  }

  const payload = JSON.parse(decodeBase64Url(encodedPayload)) as {
    userId: string
    role: UserRole
    exp: number
  }

  if (!payload.userId || !payload.role || payload.exp < Date.now()) {
    return null
  }

  return payload
}
