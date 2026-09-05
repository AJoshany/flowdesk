import { spawnSync } from "node:child_process";
import { Client } from "pg";
import { loadProjectEnv, requireEnv } from "./helpers/env";

/**
 * Provisioning strategy (approved in the implementation plan):
 * a dedicated test database (TEST_DATABASE_URL) that is migrated with the
 * committed Prisma migrations and truncated before each test run. Tests never
 * touch the development database.
 */
export default async function globalSetup(): Promise<void> {
  loadProjectEnv();
  const testUrl = requireEnv("TEST_DATABASE_URL");

  await ensureDatabaseExists(testUrl);

  // Apply committed migrations to the test database.
  const migrate = spawnSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: testUrl },
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (migrate.status !== 0) {
    throw new Error(`prisma migrate deploy failed:\n${migrate.stderr || migrate.stdout}`);
  }

  // Start from a clean slate (truncate all tables).
  const client = new Client({ connectionString: testUrl });
  await client.connect();
  try {
    await client.query(
      'TRUNCATE TABLE "Membership", "Workspace", "User" RESTART IDENTITY CASCADE;'
    );
  } finally {
    await client.end();
  }
}

async function ensureDatabaseExists(url: string): Promise<void> {
  const probe = new Client({ connectionString: url });
  try {
    await probe.connect();
    await probe.end();
    return;
  } catch (error) {
    const code = (error as { code?: string }).code;
    // Database does not exist yet (invalid_catalog_name / 3D000).
    if (code !== "3D000" && code !== "INVALID_CATALOG_NAME") {
      throw error;
    }
  }

  const databaseName = url.split("/").pop();
  if (!databaseName) {
    throw new Error(`Could not parse database name from ${url}`);
  }

  // Connect to the same server (the "postgres" maintenance database) to
  // create the test database.
  const serverUrl = url.replace(/\/[^/]+$/, "/postgres");
  const admin = new Client({ connectionString: serverUrl });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${databaseName}"`);
  } finally {
    await admin.end();
  }
}
