import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// The project keeps its environment in `.env/.env.dev`, which is not
// auto-loaded by the Prisma CLI. Load it explicitly before config evaluation.
const envFile = ".env/.env.dev";
if (!process.env.DATABASE_URL && existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

// DATABASE_URL is required to *connect* (migrate/db commands), but not to
// generate the client. `prisma generate` runs during `pnpm install` (see
// package.json postinstall) in sandboxes/CI where no real Postgres exists,
// so fall back to a placeholder instead of failing config evaluation.
// Production always provides a real DATABASE_URL.
const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://localhost:5432/flowdesk";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
