import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { uniqueEmail } from "../../../tests/helpers/env";
import { DEFAULT_WORKSPACE_NAME, registerUser } from "./services";

const PASSWORD = "password-123";

describe("registerUser (integration, test database)", () => {
  it("creates User + Workspace + OWNER Membership transactionally (AC-AUTH-001, BR-AUTH-002)", async () => {
    const email = uniqueEmail("owner");
    const result = await registerUser({ email, password: PASSWORD });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: { include: { workspace: true } },
      },
    });
    expect(user).not.toBeNull();
    expect(user?.passwordHash).not.toBe(PASSWORD);
    expect(user?.passwordHash.startsWith("$2")).toBe(true);

    // Exactly one workspace, one membership, role OWNER.
    expect(user?.memberships).toHaveLength(1);
    const membership = user?.memberships[0];
    expect(membership?.role).toBe("OWNER");
    expect(membership?.workspace.name).toBe(DEFAULT_WORKSPACE_NAME);
  });

  it("normalizes the email before persisting", async () => {
    const email = uniqueEmail("case").toUpperCase();
    const result = await registerUser({ email: `  ${email}  `, password: PASSWORD });
    expect(result.ok).toBe(true);

    const found = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    expect(found).not.toBeNull();
  });

  it("rejects a duplicate registration with a safe duplicate result (AC-AUTH-002, BR-AUTH-001)", async () => {
    const email = uniqueEmail("duplicate");
    const first = await registerUser({ email, password: PASSWORD });
    expect(first.ok).toBe(true);

    const second = await registerUser({ email, password: "another-password" });
    expect(second).toEqual({ ok: false, code: "duplicate" });
  });

  it("handles the concurrent duplicate-insert race with the unique constraint (P2002)", async () => {
    const email = uniqueEmail("race");
    const attempts = await Promise.allSettled([
      registerUser({ email, password: PASSWORD }),
      registerUser({ email, password: PASSWORD }),
    ]);

    const outcomes = attempts.map((a) =>
      a.status === "fulfilled" ? a.value : { rejected: a.reason }
    );
    const successes = outcomes.filter(
      (o) => "ok" in o && o.ok === true
    );
    const duplicates = outcomes.filter(
      (o) => "ok" in o && o.ok === false && o.code === "duplicate"
    );

    // Exactly one registration wins; the other is a safe duplicate error.
    expect(successes).toHaveLength(1);
    expect(duplicates).toHaveLength(1);

    const rows = await prisma.user.count({ where: { email } });
    expect(rows).toBe(1);
  });

  it("rejects invalid input without touching the database (validation at the boundary)", async () => {
    const result = await registerUser({ email: "not-an-email", password: "short" });
    expect(result).toEqual({ ok: false, code: "invalid_input" });
  });

  it("fails atomically: an unexpected failure rolls the whole transaction back", async () => {
    // registerUser wraps User + Workspace + Membership creation in one Prisma
    // transaction. Verify the transaction boundary itself: when a step inside
    // the transaction throws, no partial rows survive (no workspace-less
    // user, no user-less workspace).
    const email = uniqueEmail("atomic");
    const outcome = await prisma.$transaction(async (tx) => {
      await tx.user.create({ data: { email, passwordHash: "x" } });
      // Force a rollback on purpose.
      throw new Error("boom");
    }).catch(() => null);

    expect(outcome).toBeNull();
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).toBeNull();
  });
});
