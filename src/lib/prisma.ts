import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

function normalizeConnectionString(url: string) {
  return url.trim().replace(/\r?\n\s*/g, "")
}

function isPostgresConnectionString(url: string) {
  return /^(postgres|postgresql):\/\//.test(url)
}

function isSupabaseHostedUrl(url: string) {
  try {
    const { hostname } = new URL(url)
    return hostname.endsWith(".supabase.co") || hostname.endsWith(".supabase.com")
  } catch {
    return false
  }
}

function ensureSslMode(url: string) {
  if (!isSupabaseHostedUrl(url) || /[?&]sslmode=/.test(url)) {
    return url
  }

  const separator = url.includes("?") ? "&" : "?"
  return `${url}${separator}uselibpqcompat=true&sslmode=require`
}

function resolveRuntimeDatabaseUrl() {
  const directUrl = process.env.DIRECT_URL ?? process.env.DIRECT_DATABASE_URL
  if (directUrl) {
    const normalizedDirectUrl = normalizeConnectionString(directUrl)
    if (isPostgresConnectionString(normalizedDirectUrl)) {
      return ensureSslMode(normalizeConnectionString(normalizedDirectUrl))
    }
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.")
  }

  return ensureSslMode(normalizeConnectionString(databaseUrl))
}

const connectionString = resolveRuntimeDatabaseUrl()

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString: connectionString as string,
    }),
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
