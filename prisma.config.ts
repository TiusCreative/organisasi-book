import "dotenv/config";
import { defineConfig } from "@prisma/config";

function normalizeConnectionString(url: string) {
  return url.trim().replace(/\r?\n\s*/g, "");
}

function isPostgresConnectionString(url: string) {
  return /^(postgres|postgresql):\/\//.test(url);
}

function isSupabaseHostedUrl(url: string) {
  try {
    const { hostname } = new URL(url);
    return hostname.endsWith(".supabase.co") || hostname.endsWith(".supabase.com");
  } catch {
    return false;
  }
}

function buildSupabaseDirectUrl(url: string) {
  try {
    const parsed = new URL(url);
    const projectRef = decodeURIComponent(parsed.username).match(/^postgres\.([a-z0-9]+)/i)?.[1];
    if (!projectRef) {
      return null;
    }

    // Supabase direct host authenticates with the `postgres` DB user.
    // Pooler URLs often use `postgres.<project-ref>` usernames.
    parsed.username = "postgres";
    parsed.hostname = `db.${projectRef}.supabase.co`;
    parsed.port = "5432";
    parsed.searchParams.delete("pgbouncer");
    parsed.searchParams.delete("connection_limit");

    return parsed.toString();
  } catch {
    return null;
  }
}

function resolvePrismaMigrationUrl() {
  const directUrl = process.env.DIRECT_URL ?? process.env.DIRECT_DATABASE_URL;
  if (directUrl) {
    const normalizedDirectUrl = normalizeConnectionString(directUrl);
    if (isPostgresConnectionString(normalizedDirectUrl)) {
      return ensureSslMode(normalizedDirectUrl);
    }
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return undefined;
  }

  const normalizedDatabaseUrl = normalizeConnectionString(databaseUrl);

  // Supabase pooler URLs fail for Prisma migrations, so derive the direct DB host when possible.
  if (normalizedDatabaseUrl.includes("pgbouncer=true") || normalizedDatabaseUrl.includes(":6543/")) {
    const directFromPooler = buildSupabaseDirectUrl(normalizedDatabaseUrl);
    if (directFromPooler) {
      return ensureSslMode(directFromPooler);
    }
  }

  return ensureSslMode(normalizedDatabaseUrl);
}

function ensureSslMode(url: string) {
  if (!isSupabaseHostedUrl(url) || /[?&]sslmode=/.test(url)) {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}uselibpqcompat=true&sslmode=require`;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: resolvePrismaMigrationUrl(),
  },
});
