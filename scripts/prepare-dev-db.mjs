/**
 * Dev-only virtual database provisioning (no real Postgres needed).
 *
 * FlowDesk's data layer is PostgreSQL via Prisma. In sandboxes/CI without a
 * reachable Postgres service, `src/lib/prisma.ts` falls back to an in-process
 * PGlite database (WASM Postgres) when DATABASE_URL is absent. This script:
 *
 *   1. Opens the same file-backed PGlite database the dev server uses
 *      (.pglite/dev — see src/lib/prisma.ts).
 *   2. Applies the committed Prisma migrations (prisma/migrations/*) in order,
 *      tracking applied ones in a `_flowdesk_migrations` table (idempotent).
 *   3. Seeds demo data (account + workspace + customers/deals/activities) so
 *      the dashboard and the other sections have something to render.
 *
 * It is invoked before `next dev` (see package.json) and exits early when a
 * real DATABASE_URL is configured, so production/dev-with-Postgres flows are
 * untouched.
 *
 * Run manually: `node scripts/prepare-dev-db.mjs`
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import bcrypt from "bcryptjs";
import { PGlite } from "@electric-sql/pglite";

// The virtual DB lives OUTSIDE the project root on purpose: the deploy
// uploader stages the raw working directory (ignoring .gitignore), and a
// live, locked database inside the project broke deploys with file-read
// errors. Must match src/lib/prisma.ts.
const PGLITE_DIR = join(homedir(), ".flowdesk", "pglite", "dev");
const MIGRATIONS_DIR = join(process.cwd(), "prisma", "migrations");
const MIGRATION_TABLE = "_flowdesk_migrations";

// Real database configured → the virtual DB is not needed.
if (process.env.DATABASE_URL) {
  console.log("prepare-dev-db: DATABASE_URL is set — skipping virtual DB.");
  process.exit(0);
}

/** Deterministic-looking id (matches the [a-z0-9] shape the app's Zod schemas accept). */
function randomId(prefix) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 20; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `${prefix}_${suffix}`;
}

async function ensureSchema(db) {
  await db.exec(`CREATE TABLE IF NOT EXISTS "${MIGRATION_TABLE}" (
    "name" TEXT PRIMARY KEY,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`);

  const entries = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  if (entries.length === 0) {
    throw new Error(`No migrations found in ${MIGRATIONS_DIR}`);
  }

  const applied = new Set(
    (await db.query(`SELECT "name" FROM "${MIGRATION_TABLE}"`)).rows.map(
      (row) => row.name
    )
  );

  for (const name of entries) {
    if (applied.has(name)) {
      continue;
    }
    const sqlFile = join(MIGRATIONS_DIR, name, "migration.sql");
    if (!existsSync(sqlFile)) {
      continue;
    }
    console.log(`prepare-dev-db: applying migration ${name}`);
    const sql = readFileSync(sqlFile, "utf8");
    await db.exec(sql);
    await db.query(
      `INSERT INTO "${MIGRATION_TABLE}" ("name") VALUES ($1)`,
      [name]
    );
  }
}

async function seed(db) {
  const demoEmail = "demo@flowdesk.dev";
  const demoPassword = "demo1234";

  const existing = await db.query(
    `SELECT "id" FROM "User" WHERE "email" = $1`,
    [demoEmail]
  );
  if (existing.rows.length > 0) {
    console.log("prepare-dev-db: demo account already seeded — skipping.");
    return;
  }

  console.log("prepare-dev-db: seeding demo account…");
  const now = new Date().toISOString();
  const userId = randomId("user");
  const workspaceId = randomId("ws");
  const membershipId = randomId("mem");

  const passwordHash = bcrypt.hashSync(demoPassword, 10);

  await db.query(
    `INSERT INTO "User" ("id", "email", "passwordHash", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $4)`,
    [userId, demoEmail, passwordHash, now]
  );
  await db.query(
    `INSERT INTO "Workspace" ("id", "name", "createdAt", "updatedAt")
     VALUES ($1, 'Acme Inc.', $2, $2)`,
    [workspaceId, now]
  );
  await db.query(
    `INSERT INTO "Membership" ("id", "userId", "workspaceId", "role", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'OWNER', $4, $4)`,
    [membershipId, userId, workspaceId, now]
  );

  const customers = [
    { name: "Northwind Traders", email: "northwind@example.com", phone: "+1 555 0100", company: "Northwind" },
    { name: "Globex Corporation", email: "globex@example.com", phone: "+1 555 0101", company: "Globex" },
    { name: "Initech", email: "initech@example.com", phone: "+1 555 0102", company: "Initech" },
  ].map((customer) => ({ id: randomId("cust"), ...customer }));

  for (const customer of customers) {
    await db.query(
      `INSERT INTO "Customer" ("id", "name", "email", "phone", "company", "workspaceId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
      [customer.id, customer.name, customer.email, customer.phone, customer.company, workspaceId, now]
    );
  }

  const deals = [
    { title: "Northwind — Q3 renewal", stage: "PROPOSAL", customer: customers[0] },
    { title: "Globex — platform migration", stage: "QUALIFIED", customer: customers[1] },
    { title: "Initech — annual license", stage: "NEW", customer: customers[2] },
    { title: "Northwind — support upsell", stage: "WON", customer: customers[0] },
    { title: "Globex — pilot expansion", stage: "LOST", customer: customers[1] },
  ].map((deal) => ({ id: randomId("deal"), ...deal }));

  for (const deal of deals) {
    await db.query(
      `INSERT INTO "Deal" ("id", "title", "stage", "customerId", "workspaceId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $6)`,
      [deal.id, deal.title, deal.stage, deal.customer.id, workspaceId, now]
    );
  }

  const activities = [
    { note: "Called to discuss Q3 renewal pricing — decision maker will review the proposal this week.", customer: customers[0], deal: deals[0] },
    { note: "Sent the platform migration proposal after the discovery call.", customer: customers[1], deal: deals[1] },
    { note: "Left a voicemail; following up by email tomorrow.", customer: customers[2], deal: deals[2] },
    { note: "Contract signed for the annual license. Onboarding scheduled.", customer: customers[0], deal: deals[3] },
  ].map((activity) => ({ id: randomId("act"), ...activity }));

  for (let i = 0; i < activities.length; i++) {
    const activity = activities[i];
    const createdAt = new Date(Date.now() - i * 86_400_000).toISOString();
    await db.query(
      `INSERT INTO "Activity" ("id", "note", "customerId", "dealId", "workspaceId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $6)`,
      [activity.id, activity.note, activity.customer.id, activity.deal.id, workspaceId, createdAt]
    );
  }

  console.log(
    `prepare-dev-db: demo account ready — ${demoEmail} / ${demoPassword}`
  );
}

async function provision() {
  mkdirSync(dirname(PGLITE_DIR), { recursive: true });
  const db = new PGlite(PGLITE_DIR);
  try {
    await ensureSchema(db);
    await seed(db);
    console.log(`prepare-dev-db: virtual database ready at ${PGLITE_DIR}`);
  } finally {
    await db.close();
  }
}

// A crash mid-provisioning can leave the data dir half-migrated. Wipe and
// retry once — the directory is a disposable dev artifact (.pglite/ is
// gitignored) and provisioning is idempotent from a clean slate.
try {
  await provision();
} catch {
  console.warn("prepare-dev-db: provisioning failed, resetting the virtual DB and retrying…");
  rmSync(PGLITE_DIR, { recursive: true, force: true });
  await provision();
}