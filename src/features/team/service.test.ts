import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { registerUser } from "@/features/auth/services";
import { countWorkspaceOwners } from "@/features/workspace/service";
import { uniqueEmail } from "../../../tests/helpers/env";
import {
  changeMemberRole,
  inviteMember,
  listTeamMembers,
  removeMember,
} from "./service";
import type { TeamRole } from "./roles";

const PASSWORD = "password-123";

/** Registers a user (creates their workspace + OWNER membership). */
async function registerOwner(prefix: string): Promise<{
  userId: string;
  email: string;
  workspaceId: string;
}> {
  const email = uniqueEmail(prefix);
  const result = await registerUser({ email, password: PASSWORD });
  if (!result.ok) throw new Error(`seed failed for ${prefix}`);
  const membership = await prisma.membership.findFirstOrThrow({
    where: { userId: result.user.id },
    select: { workspaceId: true },
  });
  return {
    userId: result.user.id,
    email: result.user.email,
    workspaceId: membership.workspaceId,
  };
}

/** Registers a user and joins them to `workspaceId` with the given role. */
async function addMember(
  workspaceId: string,
  role: TeamRole,
  prefix: string
): Promise<{ userId: string; email: string; membershipId: string }> {
  const user = await registerOwner(prefix);
  const membership = await prisma.membership.create({
    data: { userId: user.userId, workspaceId, role },
    select: { id: true },
  });
  return { userId: user.userId, email: user.email, membershipId: membership.id };
}

async function membershipIdOf(userId: string, workspaceId: string): Promise<string> {
  const row = await prisma.membership.findUniqueOrThrow({
    where: { userId_workspaceId: { userId, workspaceId } },
    select: { id: true },
  });
  return row.id;
}

describe("team service (integration, test database)", () => {
  it("lists only the members of the given workspace (AC-TEAM-001)", async () => {
    const a = await registerOwner("team-list-a");
    const b = await registerOwner("team-list-b");
    const memberA = await addMember(a.workspaceId, "MEMBER", "team-list-a-member");

    const membersA = await listTeamMembers(a.workspaceId);
    const membersB = await listTeamMembers(b.workspaceId);

    expect(membersA.map((m) => m.email)).toContain(a.email);
    expect(membersA.map((m) => m.email)).toContain(memberA.email);
    // Nothing from workspace B leaks into A's list (workspace isolation).
    expect(membersB.map((m) => m.email)).not.toContain(memberA.email);
    expect(membersA.some((m) => membersB.some((x) => x.id === m.id))).toBe(false);

    // Rows expose the shape the UI needs: membership id, user id, email, role.
    expect(membersA[0]).toMatchObject({
      id: expect.any(String),
      userId: expect.any(String),
      email: expect.any(String),
      role: expect.any(String),
      createdAt: expect.any(Date),
    });
  });

  // -- invitations -------------------------------------------------------

  it("lets an OWNER invite a registered user with any role (AC-TEAM-002)", async () => {
    const owner = await registerOwner("team-inv-owner");
    const invitee = await registerOwner("team-inv-invitee");

    const result = await inviteMember(owner.workspaceId, "OWNER", {
      email: invitee.email,
      role: "MANAGER",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({ email: invitee.email, role: "MANAGER" });
    }
    const row = await prisma.membership.findUnique({
      where: {
        userId_workspaceId: { userId: invitee.userId, workspaceId: owner.workspaceId },
      },
    });
    expect(row?.role).toBe("MANAGER");
  });

  it("lets a MANAGER invite a member with a MANAGER/MEMBER role (BR-TEAM-005)", async () => {
    const owner = await registerOwner("team-inv-mgr-owner");
    const manager = await addMember(owner.workspaceId, "MANAGER", "team-inv-mgr");
    const invitee = await registerOwner("team-inv-mgr-invitee");

    const result = await inviteMember(owner.workspaceId, "MANAGER", {
      email: invitee.email,
      role: "MEMBER",
    });
    expect(result.ok).toBe(true);
    expect(manager.membershipId).toBeTruthy();
  });

  it("rejects a MEMBER invite (AC-TEAM-003, BR-TEAM-006)", async () => {
    const owner = await registerOwner("team-inv-member-owner");
    // A plain MEMBER actor exists in the workspace (BR-TEAM-006).
    await addMember(owner.workspaceId, "MEMBER", "team-inv-member");
    const invitee = await registerOwner("team-inv-member-invitee");

    const result = await inviteMember(owner.workspaceId, "MEMBER", {
      email: invitee.email,
      role: "MEMBER",
    });
    expect(result).toEqual({ ok: false, code: "unauthorized" });
    const count = await prisma.membership.count({
      where: { workspaceId: owner.workspaceId, userId: invitee.userId },
    });
    expect(count).toBe(0);
  });

  it("rejects a MANAGER granting the OWNER role (finalized role rules)", async () => {
    const owner = await registerOwner("team-inv-mgr-owner2");
    await addMember(owner.workspaceId, "MANAGER", "team-inv-mgr2");
    const invitee = await registerOwner("team-inv-mgr2-invitee");

    const result = await inviteMember(owner.workspaceId, "MANAGER", {
      email: invitee.email,
      role: "OWNER",
    });
    expect(result).toEqual({ ok: false, code: "cannot_assign_owner" });
    const count = await prisma.membership.count({
      where: { workspaceId: owner.workspaceId, userId: invitee.userId },
    });
    expect(count).toBe(0);
  });

  it("rejects inviting an email with no account (no disclosure)", async () => {
    const owner = await registerOwner("team-inv-unknown");
    const result = await inviteMember(owner.workspaceId, "OWNER", {
      email: uniqueEmail("nobody"),
      role: "MEMBER",
    });
    expect(result).toEqual({ ok: false, code: "user_not_found" });
  });

  it("rejects an already-a-member / second invite (edge cases §10)", async () => {
    const owner = await registerOwner("team-inv-dup");
    const invitee = await registerOwner("team-inv-dup-invitee");

    const first = await inviteMember(owner.workspaceId, "OWNER", {
      email: invitee.email,
      role: "MEMBER",
    });
    expect(first.ok).toBe(true);

    // Invited twice → duplicate membership.
    const second = await inviteMember(owner.workspaceId, "OWNER", {
      email: invitee.email,
      role: "MANAGER",
    });
    expect(second).toEqual({ ok: false, code: "already_member" });

    // Inviting an existing member (the OWNER themselves) → same rejection.
    const self = await inviteMember(owner.workspaceId, "OWNER", {
      email: owner.email,
      role: "MEMBER",
    });
    expect(self).toEqual({ ok: false, code: "already_member" });
  });

  it("rejects an invalid role value (BR-TEAM-003, validation §7)", async () => {
    const owner = await registerOwner("team-inv-badrole");
    const invitee = await registerOwner("team-inv-badrole-invitee");
    const result = await inviteMember(owner.workspaceId, "OWNER", {
      email: invitee.email,
      role: "ADMIN" as TeamRole,
    });
    expect(result).toEqual({ ok: false, code: "invalid_input" });
  });

  // -- role assignment ---------------------------------------------------

  it("lets an OWNER assign any role (AC-TEAM-004)", async () => {
    const owner = await registerOwner("team-role-owner");
    const target = await addMember(owner.workspaceId, "MEMBER", "team-role-target");

    const result = await changeMemberRole(
      owner.workspaceId,
      owner.userId,
      "OWNER",
      target.membershipId,
      "MANAGER"
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({ id: target.membershipId, role: "MANAGER" });
    }
    const row = await prisma.membership.findUniqueOrThrow({
      where: { id: target.membershipId },
    });
    expect(row.role).toBe("MANAGER");
  });

  it("lets an OWNER promote a member to OWNER and demote a co-OWNER", async () => {
    const owner = await registerOwner("team-role-promote");
    const target = await addMember(owner.workspaceId, "MEMBER", "team-role-promote-target");

    const promoted = await changeMemberRole(
      owner.workspaceId,
      owner.userId,
      "OWNER",
      target.membershipId,
      "OWNER"
    );
    expect(promoted.ok).toBe(true);
    await expect(countWorkspaceOwners(owner.workspaceId)).resolves.toBe(2);

    // A co-OWNER can be demoted while one OWNER remains.
    const demoted = await changeMemberRole(
      owner.workspaceId,
      owner.userId,
      "OWNER",
      target.membershipId,
      "MANAGER"
    );
    expect(demoted.ok).toBe(true);
    await expect(countWorkspaceOwners(owner.workspaceId)).resolves.toBe(1);
  });

  it("rejects a MEMBER role change (AC-TEAM-005, BR-TEAM-007)", async () => {
    const owner = await registerOwner("team-role-member");
    const actor = await addMember(owner.workspaceId, "MEMBER", "team-role-member-actor");
    const target = await addMember(owner.workspaceId, "MEMBER", "team-role-member-target");

    const result = await changeMemberRole(
      owner.workspaceId,
      actor.userId,
      "MEMBER",
      target.membershipId,
      "MANAGER"
    );
    expect(result).toEqual({ ok: false, code: "unauthorized" });
    const row = await prisma.membership.findUniqueOrThrow({
      where: { id: target.membershipId },
    });
    expect(row.role).toBe("MEMBER");
  });

  it("lets a MANAGER manage MANAGER/MEMBER members (finalized MANAGER rules)", async () => {
    const owner = await registerOwner("team-role-mgr");
    const manager = await addMember(owner.workspaceId, "MANAGER", "team-role-mgr-manager");
    const member = await addMember(owner.workspaceId, "MEMBER", "team-role-mgr-member");

    const promote = await changeMemberRole(
      owner.workspaceId,
      manager.userId,
      "MANAGER",
      member.membershipId,
      "MANAGER"
    );
    expect(promote.ok).toBe(true);

    const demote = await changeMemberRole(
      owner.workspaceId,
      manager.userId,
      "MANAGER",
      member.membershipId,
      "MEMBER"
    );
    expect(demote.ok).toBe(true);
  });

  it("rejects a MANAGER changing an OWNER's role (finalized MANAGER rules)", async () => {
    const owner = await registerOwner("team-role-mgr-owner");
    const manager = await addMember(owner.workspaceId, "MANAGER", "team-role-mgr2");
    const ownerMembershipId = await membershipIdOf(owner.userId, owner.workspaceId);

    const result = await changeMemberRole(
      owner.workspaceId,
      manager.userId,
      "MANAGER",
      ownerMembershipId,
      "MEMBER"
    );
    expect(result).toEqual({ ok: false, code: "cannot_change_owner" });
  });

  it("rejects a MANAGER granting the OWNER role (finalized MANAGER rules)", async () => {
    const owner = await registerOwner("team-role-mgr-owner2");
    const manager = await addMember(owner.workspaceId, "MANAGER", "team-role-mgr3");
    const member = await addMember(owner.workspaceId, "MEMBER", "team-role-mgr3-member");

    const result = await changeMemberRole(
      owner.workspaceId,
      manager.userId,
      "MANAGER",
      member.membershipId,
      "OWNER"
    );
    expect(result).toEqual({ ok: false, code: "cannot_assign_owner" });
  });

  it("rejects a user changing their own role (edge case §10)", async () => {
    const owner = await registerOwner("team-role-self");
    const member = await addMember(owner.workspaceId, "MEMBER", "team-role-self-member");

    // A MANAGER cannot demote or re-role themselves.
    const selfManager = await changeMemberRole(
      owner.workspaceId,
      member.userId,
      "MANAGER",
      member.membershipId,
      "MANAGER"
    );
    expect(selfManager).toEqual({ ok: false, code: "own_membership" });
  });

  it("protects the last OWNER (BR-WS-002)", async () => {
    const owner = await registerOwner("team-last-owner");
    const ownerMembershipId = await membershipIdOf(owner.userId, owner.workspaceId);

    // The only OWNER cannot be demoted — even by themselves (checked as the
    // last-OWNER protection before the self-change rule).
    const demote = await changeMemberRole(
      owner.workspaceId,
      owner.userId,
      "OWNER",
      ownerMembershipId,
      "MEMBER"
    );
    expect(demote).toEqual({ ok: false, code: "last_owner" });

    // And can never be removed through member management.
    const remove = await removeMember(owner.workspaceId, "OWNER", ownerMembershipId);
    expect(remove).toEqual({ ok: false, code: "cannot_remove_owner" });

    // The invariant still holds after the rejected attempts.
    await expect(countWorkspaceOwners(owner.workspaceId)).resolves.toBe(1);
  });

  it("cannot change the role of a membership from another workspace (BR-TEAM-010)", async () => {
    const a = await registerOwner("team-xrole-a");
    const b = await registerOwner("team-xrole-b");
    const bMember = await addMember(b.workspaceId, "MEMBER", "team-xrole-b-member");

    const result = await changeMemberRole(
      a.workspaceId,
      a.userId,
      "OWNER",
      bMember.membershipId,
      "MANAGER"
    );
    expect(result).toEqual({ ok: false, code: "not_found" });
    const row = await prisma.membership.findUniqueOrThrow({
      where: { id: bMember.membershipId },
    });
    expect(row.role).toBe("MEMBER");
  });

  it("rejects invalid roles and malformed/unknown membership ids", async () => {
    const owner = await registerOwner("team-role-bad");
    const member = await addMember(owner.workspaceId, "MEMBER", "team-role-bad-member");

    const badRole = await changeMemberRole(
      owner.workspaceId,
      owner.userId,
      "OWNER",
      member.membershipId,
      "ADMIN" as TeamRole
    );
    expect(badRole).toEqual({ ok: false, code: "invalid_input" });

    const badId = await changeMemberRole(
      owner.workspaceId,
      owner.userId,
      "OWNER",
      "not a valid id!",
      "MANAGER"
    );
    expect(badId).toEqual({ ok: false, code: "invalid_input" });

    const unknown = await changeMemberRole(
      owner.workspaceId,
      owner.userId,
      "OWNER",
      "cafebabecafebabecafebabe",
      "MANAGER"
    );
    expect(unknown).toEqual({ ok: false, code: "not_found" });
  });

  // -- member removal ----------------------------------------------------

  it("lets an OWNER remove an eligible member (AC-TEAM-006)", async () => {
    const owner = await registerOwner("team-rem-owner");
    const member = await addMember(owner.workspaceId, "MEMBER", "team-rem-member");

    const result = await removeMember(owner.workspaceId, "OWNER", member.membershipId);
    expect(result).toEqual({ ok: true, value: null });
    await expect(
      prisma.membership.findUnique({ where: { id: member.membershipId } })
    ).resolves.toBeNull();
  });

  it("lets an OWNER remove a MANAGER", async () => {
    const owner = await registerOwner("team-rem-mgr");
    const manager = await addMember(owner.workspaceId, "MANAGER", "team-rem-manager");

    const result = await removeMember(owner.workspaceId, "OWNER", manager.membershipId);
    expect(result).toEqual({ ok: true, value: null });
  });

  it("rejects MANAGER and MEMBER removal (BR-TEAM-008, permission matrix)", async () => {
    const owner = await registerOwner("team-rem-unauth");
    const manager = await addMember(owner.workspaceId, "MANAGER", "team-rem-unauth-mgr");
    const member = await addMember(owner.workspaceId, "MEMBER", "team-rem-unauth-member");

    const byManager = await removeMember(owner.workspaceId, "MANAGER", member.membershipId);
    expect(byManager).toEqual({ ok: false, code: "unauthorized" });

    const byMember = await removeMember(owner.workspaceId, "MEMBER", manager.membershipId);
    expect(byMember).toEqual({ ok: false, code: "unauthorized" });

    // Nothing was removed.
    await expect(
      prisma.membership.findUnique({ where: { id: member.membershipId } })
    ).resolves.not.toBeNull();
    await expect(
      prisma.membership.findUnique({ where: { id: manager.membershipId } })
    ).resolves.not.toBeNull();
  });

  it("rejects removing an OWNER, even by another OWNER (AC-TEAM-007, BR-TEAM-009)", async () => {
    const owner = await registerOwner("team-rem-owner2");
    const coOwner = await addMember(owner.workspaceId, "OWNER", "team-rem-coowner");

    const result = await removeMember(owner.workspaceId, "OWNER", coOwner.membershipId);
    expect(result).toEqual({ ok: false, code: "cannot_remove_owner" });
    await expect(
      prisma.membership.findUnique({ where: { id: coOwner.membershipId } })
    ).resolves.not.toBeNull();
  });

  it("cannot remove a member of another workspace (BR-TEAM-010)", async () => {
    const a = await registerOwner("team-xrem-a");
    const b = await registerOwner("team-xrem-b");
    const bMember = await addMember(b.workspaceId, "MEMBER", "team-xrem-b-member");

    const result = await removeMember(a.workspaceId, "OWNER", bMember.membershipId);
    expect(result).toEqual({ ok: false, code: "not_found" });
    await expect(
      prisma.membership.findUnique({ where: { id: bMember.membershipId } })
    ).resolves.not.toBeNull();
  });

  it("rejects a malformed membership id on removal (validation §7)", async () => {
    const owner = await registerOwner("team-rem-bad");
    const result = await removeMember(owner.workspaceId, "OWNER", "bad id!!");
    expect(result).toEqual({ ok: false, code: "invalid_input" });
  });
});