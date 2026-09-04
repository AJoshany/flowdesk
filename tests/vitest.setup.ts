import { loadProjectEnv, requireEnv } from "./helpers/env";

/**
 * Runs in each Vitest worker before any test module is imported.
 * Points the Prisma client at the dedicated test database so tests never
 * touch the development database.
 */
loadProjectEnv();
process.env.DATABASE_URL = requireEnv("TEST_DATABASE_URL");
