import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaPGlite } from "pglite-prisma-adapter";
import { PrismaClient } from "@prisma/client";

// Central server-side Prisma access point. Client components must never
// import this module (the adapter holds the database connection string).

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const PGLITE_DIR = join(process.cwd(), ".pglite", "dev");

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (connectionString) {
    // Production / real Postgres path.
    const adapter = new PrismaPg({ connectionString });
    return new PrismaClient({ adapter });
  }

  // Dev-only virtual database: an in-process PGlite (WASM Postgres) instance
  // backed by a local data directory. `scripts/prepare-dev-db.mjs` provisions
  // the schema (committed migrations) and demo data before `next dev` starts.
  // Never used in production — production must provide DATABASE_URL.
  if (process.env.NODE_ENV !== "production") {
    mkdirSync(dirname(PGLITE_DIR), { recursive: true });
    const pglite = new PGlite(PGLITE_DIR);
    const adapter = new PrismaPGlite(pglite);
    return new PrismaClient({ adapter });
  }

  throw new Error("DATABASE_URL is not set.");
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}