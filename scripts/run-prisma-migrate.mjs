import "dotenv/config";
import { spawnSync } from "node:child_process";

const env = { ...process.env };
const directUrl = env.DIRECT_URL ?? env.DIRECT_DATABASE_URL;
const databaseUrl = env.DATABASE_URL ?? "";
const isSupabasePooler =
  databaseUrl.includes(".pooler.supabase.com") ||
  databaseUrl.includes(":6543/") ||
  databaseUrl.includes("pgbouncer=true");
const shouldRunMigrate = env.RUN_PRISMA_MIGRATE === "true";

if (!shouldRunMigrate) {
  console.warn(
    [
      "Skipping `prisma migrate deploy` during build.",
      "Set RUN_PRISMA_MIGRATE=true if you want Vercel builds to apply migrations automatically.",
    ].join(" "),
  );
  process.exit(0);
}

if (!directUrl && isSupabasePooler) {
  console.warn(
    [
      "No DIRECT_URL provided.",
      "Falling back to prisma.config.ts to derive a direct Supabase connection from the pooler URL.",
    ].join(" "),
  );
}

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["prisma", "migrate", "deploy", "--config", "prisma.config.ts", "--schema", "prisma/schema.prisma"],
  {
    stdio: "inherit",
    env,
  },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
