import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { registerUser } from "@/features/auth/services";
import { uniqueEmail } from "../../../tests/helpers/env";
import { countWorkspaceOwners, findWorkspaceMembership } from "./service";

const PASSWORD = "password-123";

/** Registers a user (creates their workspace + OWNER membership) and returns
 * their user id and their primary workspace id. */
async function registerOwner(prefix: string): Promise<{
  userId: string;
  workspaceId: string;
}> {
  const email = uniqueEmail(prefix);
  const result = await registerUser({ email, password: PASSWORD });
  if (!result.ok) throw new Error(`seed failed for ${prefix}`);
  const membership = await prisma.membership.findFirstOrThrow({
    where: { userId: result.user.id },
    select: { workspaceId: true },
  });
  return { userId: result.user.id, workspaceId: membership.workspaceId };
}

/** Adds (or updates) the membership for `userId` in `workspaceId`. */
async function addMembership(
  userId: string,
  workspaceId: string,
  role: "OWNER" | "MANAGER" | "MEMBER"
): Promise<void> {
  await prisma.membership.upsert({
    where: { userId_workspaceId: { userId, workspaceId } },
    update: { role },
    create: { userId, workspaceId, role },
  });
}

describe("workspace membership service (integration, test database)", () => {
  it("resolves the OWNER membership created at registration (BR-WS-001, AC-WS-001)", async () => {
    const { userId, workspaceId } = await registerOwner("svc-owner");

    await expect(findWorkspaceMembership(userId, workspaceId)).resolves.toEqual({
      workspaceId,
      role: "OWNER",
    });
  });

  it("returns null when the user is not a member of the workspace (AC-WS-002)", async () => {
    const a = await registerOwner("svc-a");
    const b = await registerOwner("svc-b");

    await expect(findWorkspaceMembership(a.userId, b.workspaceId)).resolves.toBeNull();
    await expect(findWorkspaceMembership(b.userId, a.workspaceId)).resolves.toBeNull();
  });

  it("returns null for a nonexistent or malformed workspace id", async () => {
    const { userId } = await registerOwner("svc-missing");

    await expect(
      findWorkspaceMembership(userId, "cafebabecafebabecafebabe")
    ).resolves.toBeNull();
    await expect(findWorkspaceMembership(userId, "")).resolves.toBeNull();
  });

  it("keeps at least one OWNER when other-role members exist (BR-WS-002)", async () => {
    const owner = await registerOwner("svc-owners");
    const member = await registerOwner("svc-extra-member");

    await expect(countWorkspaceOwners(owner.workspaceId)).resolves.toBe(1);

    // A MANAGER and a MEMBER join the OWNER's workspace: the OWNER remains.
    await addMembership(member.userId, owner.workspaceId, "MANAGER");
    await expect(countWorkspaceOwners(owner.workspaceId)).resolves.toBe(1);

    // A second OWNER would increase the count — the invariant only requires ≥ 1.
    await addMembership(member.userId, owner.workspaceId, "OWNER");
    await expect(countWorkspaceOwners(owner.workspaceId)).resolves.toBe(2);
  });

  it("resolves the role that is scoped to the specific workspace (database.md §5)", async () => {
    const owner = await registerOwner("svc-role-owner");
    const other = await registerOwner("svc-role-other");

    // `other` is OWNER of their own workspace and joins `owner`'s workspace as MEMBER.
    await addMembership(other.userId, owner.workspaceId, "MEMBER");

    await expect(
      findWorkspaceMembership(other.userId, other.workspaceId)
    ).resolves.toEqual({ workspaceId: other.workspaceId, role: "OWNER" });
    await expect(
      findWorkspaceMembership(other.userId, owner.workspaceId)
    ).resolves.toEqual({ workspaceId: owner.workspaceId, role: "MEMBER" });
  });

  it("never returns memberships the user does not hold (workspace isolation)", async () => {
    const a = await registerOwner("svc-iso-a");
    const b = await registerOwner("svc-iso-b");
    await addMembership(a.userId, b.workspaceId, "MEMBER");

    // A holds membership in A and B workspaces only — not in any third workspace.
    const aRows = await prisma.membership.findMany({
      where: { userId: a.userId },
      select: { workspaceId: true },
    });
    expect(aRows).toHaveLength(2);

    // A's OWNER workspace still has exactly one OWNER (B's data untouched).
    await expect(countWorkspaceOwners(a.workspaceId)).resolves.toBe(1);
    await expect(countWorkspaceOwners(b.workspaceId)).resolves.toBe(1);
  });
});
