import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaPGlite } from "pglite-prisma-adapter";
import { PrismaClient } from "@prisma/client";

// Central server-side Prisma access point. Client components must never
// import this module (the adapter holds the database connection string).
//
// The client is created LAZILY: importing this module never touches the
// database, so static builds (`next build`, page-data collection) succeed
// even when DATABASE_URL is not configured yet. The real client is created
// on first access at runtime:
//   - DATABASE_URL set            → real Postgres via PrismaPg
//   - no DATABASE_URL, dev        → in-process PGlite (WASM Postgres)
//   - no DATABASE_URL, production → clear error (production must set it)

export type { PrismaClient } from "@prisma/client";

// The virtual DB lives OUTSIDE the project root on purpose: the deploy
// uploader stages the raw working directory (ignoring .gitignore), and a
// live, locked database inside the project broke deploys with file-read
// errors. It is a disposable dev artifact, so a home-dir location is fine.
const PGLITE_DIR = join(homedir(), ".flowdesk", "pglite", "dev");

let prismaPromise: Promise<PrismaClient> | null = null;

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (connectionString) {
    // Real Postgres path (production and dev-with-Postgres).
    const adapter = new PrismaPg({ connectionString });
    return new PrismaClient({ adapter });
  }

  if (process.env.NODE_ENV !== "production") {
    // Dev-only virtual database: an in-process PGlite (WASM Postgres)
    // backed by a local data directory. `scripts/prepare-dev-db.mjs`
    // provisions the schema and demo data before `next dev` starts.
    mkdirSync(dirname(PGLITE_DIR), { recursive: true });
    const pglite = new PGlite(PGLITE_DIR);
    const adapter = new PrismaPGlite(pglite);
    return new PrismaClient({ adapter });
  }

  throw new Error(
    "DATABASE_URL is not set. Production deployments must provide a DATABASE_URL."
  );
}

function getPrisma(): Promise<PrismaClient> {
  if (!prismaPromise) {
    prismaPromise = Promise.resolve().then(() => createPrismaClient());
    // Prevent unhandled rejection when the first access happens during a
    // build without DATABASE_URL — the error surfaces on the call site.
    prismaPromise.catch(() => undefined);
  }
  return prismaPromise;
}

/**
 * Lazy delegate for `prisma.<model>`: every method call waits for the real
 * client and forwards to the model delegate, so `prisma.user.findMany(...)`
 * behaves exactly like the real client at runtime.
 */
function lazyModel(modelName: string) {
  return new Proxy({} as object, {
    get(_, method) {
      if (method === "then") return undefined;
      return (...args: unknown[]) =>
        getPrisma().then((client) => {
          const delegate = (client as unknown as Record<string, unknown>)[
            modelName
          ] as Record<string, unknown>;
          const fn = delegate[String(method)] as (...a: unknown[]) => unknown;
          return fn(...args);
        });
    },
    set() {
      return true;
    },
  });
}

/**
 * Lazy Prisma client. `prisma.model.method(...)` returns a promise that
 * resolves once the real client exists. Top-level `$` helpers
 * (`$transaction`, `$queryRaw`, `$connect`, …) forward the same way.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop) {
    if (prop === "then") return undefined;
    const key = String(prop);
    if (key.startsWith("$")) {
      return (...args: unknown[]) =>
        getPrisma().then((client) => {
          const fn = (client as unknown as Record<string, unknown>)[
            key
          ] as (...a: unknown[]) => unknown;
          return fn(...args);
        });
    }
    return lazyModel(key);
  },
  set() {
    return true;
  },
}) as unknown as PrismaClient;