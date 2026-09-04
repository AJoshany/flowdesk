import { existsSync } from "node:fs";
import { defineConfig, env } from "prisma/config";

// The project keeps its environment in `.env/.env.dev`, which is not
// auto-loaded by the Prisma CLI. Load it explicitly before config evaluation.
const envFile = ".env/.env.dev";
if (!process.env.DATABASE_URL && existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
