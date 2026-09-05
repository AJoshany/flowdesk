import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { countWorkspaceOwners } from "@/features/workspace/service";
import {
  changeRoleSchema,
  inviteMemberSchema,
  membershipIdSchema,
  type InviteMemberInput,
} from "./schemas";
import type { TeamRole } from "./roles";

/**
 * Team data access and authorization rules (server-only).
 *
 * AUTHORIZATION BOUNDARY: every query is scoped by the authorized
 * `workspaceId` and driven by the actor role that callers MUST resolve
 * server-side from the session workspace context (never from client input).
 * A membership is never queried "by id only" (docs/architecture/database.md
 * §10) — reads, updates and deletes all carry `workspaceId` in the WHERE
 * clause, so a membership from another workspace is indistinguishable from
 * a missing one (BR-TEAM-010).
 *
 * Invitation (US-TEAM-002) is membership creation for an existing
 * registered user (docs/plans/team.md §4): no pending invitation entity, no
 * email delivery — the invited user becomes a workspace member with the
 * requested role.
 */

const teamMemberSelect = {
  id: true,
  role: true,
  createdAt: true,
  user: { select: { id: true, email: true } },
} as const;

export type TeamMember = {
  id: string;
  userId: string;
  email: string;
  role: TeamRole;
  createdAt: Date;
};

export type TeamMutationResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      code:
        | "invalid_input"
        | "unauthorized"
        | "not_found"
        | "already_member"
        | "user_not_found"
        | "cannot_change_owner"
        | "cannot_assign_owner"
        | "own_membership"
        | "last_owner"
        | "cannot_remove_owner";
    };

function toTeamMember(row: {
  id: string;
  role: TeamRole;
  createdAt: Date;
  user: { id: string; email: string };
}): TeamMember {
  return {
    id: row.id,
    userId: row.user.id,
    email: row.user.email,
    role: row.role,
    createdAt: row.createdAt,
  };
}

/**
 * Loads a membership ONLY when it belongs to `workspaceId`. A membership of
 * another workspace (or a missing one) returns null — no existence disclosure.
 */
async function findScopedMembership(
  workspaceId: string,
  membershipId: string
): Promise<{ id: string; userId: string; role: TeamRole } | null> {
  return prisma.membership.findFirst({
    where: { id: membershipId, workspaceId },
    select: { id: true, userId: true, role: true },
  });
}

/** All members of `workspaceId`, oldest first (AC-TEAM-001). */
export async function listTeamMembers(workspaceId: string): Promise<TeamMember[]> {
  const rows = await prisma.membership.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
    select: teamMemberSelect,
  });
  return rows.map((row) => toTeamMember(row));
}

/**
 * Invites a member (AC-TEAM-002/003, BR-TEAM-004/005/006).
 *
 * The invitee must be an existing registered FlowDesk user ("invite a valid
 * user"). The requested role is validated against the enum and the actor's
 * authority: MEMBER cannot invite; MANAGER may invite but can never grant
 * the OWNER role.
 */
export async function inviteMember(
  workspaceId: string,
  actorRole: TeamRole,
  input: InviteMemberInput
): Promise<TeamMutationResult<TeamMember>> {
  const parsed = inviteMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "invalid_input" };
  }
  const { email, role } = parsed.data;

  if (actorRole === "MEMBER") {
    return { ok: false, code: "unauthorized" };
  }
  if (actorRole === "MANAGER" && role === "OWNER") {
    return { ok: false, code: "cannot_assign_owner" };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) {
    return { ok: false, code: "user_not_found" };
  }

  // Duplicate membership — "User is already a member" / "invited twice".
  const existing = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId } },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, code: "already_member" };
  }

  try {
    const membership = await prisma.membership.create({
      data: { userId: user.id, workspaceId, role },
      select: teamMemberSelect,
    });
    return { ok: true, value: toTeamMember(membership) };
  } catch (error) {
    // Concurrent duplicate invite: the unique membership constraint rejects
    // the second insert (P2002). Map it to the same safe error.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, code: "already_member" };
    }
    throw error;
  }
}

/**
 * Assigns a role (AC-TEAM-004/005, BR-TEAM-007, spec §6 finalized rules).
 *
 * - MEMBER cannot assign roles.
 * - MANAGER may assign MANAGER/MEMBER roles to members holding MANAGER/MEMBER
 *   only — never the OWNER role, never an OWNER's role.
 * - OWNER may assign any role to any member.
 * - No operation may leave the workspace without an OWNER (BR-WS-002).
 * - A user cannot modify their own role (spec §10 edge case).
 */
export async function changeMemberRole(
  workspaceId: string,
  actorUserId: string,
  actorRole: TeamRole,
  membershipId: string,
  requestedRole: TeamRole
): Promise<TeamMutationResult<TeamMember>> {
  const parsed = changeRoleSchema.safeParse({
    membershipId,
    role: requestedRole,
  });
  if (!parsed.success) {
    return { ok: false, code: "invalid_input" };
  }

  const target = await findScopedMembership(workspaceId, parsed.data.membershipId);
  if (!target) {
    return { ok: false, code: "not_found" };
  }
  const { role } = parsed.data;

  if (actorRole === "MEMBER") {
    return { ok: false, code: "unauthorized" };
  }
  if (actorRole === "MANAGER") {
    if (target.role === "OWNER") {
      return { ok: false, code: "cannot_change_owner" };
    }
    if (role === "OWNER") {
      return { ok: false, code: "cannot_assign_owner" };
    }
  }

  // BR-WS-002: no operation may leave the workspace without an OWNER. Checked
  // before the self-change rule so the last OWNER's own demotion is rejected
  // here rather than as a mere self-change.
  if (
    target.role === "OWNER" &&
    role !== "OWNER" &&
    (await countWorkspaceOwners(workspaceId)) === 1
  ) {
    return { ok: false, code: "last_owner" };
  }

  // Edge case (§10): a user may not modify their own role.
  if (target.userId === actorUserId) {
    return { ok: false, code: "own_membership" };
  }

  // The write carries the workspace boundary in its WHERE clause.
  const result = await prisma.membership.updateMany({
    where: { id: target.id, workspaceId },
    data: { role },
  });
  if (result.count === 0) {
    return { ok: false, code: "not_found" };
  }

  const updated = await prisma.membership.findFirst({
    where: { id: target.id, workspaceId },
    select: teamMemberSelect,
  });
  if (!updated) {
    return { ok: false, code: "not_found" };
  }
  return { ok: true, value: toTeamMember(updated) };
}

/**
 * Removes a member (AC-TEAM-006/007, BR-TEAM-008/009).
 *
 * Removal is OWNER-only. An OWNER can never be removed through normal member
 * management — rejecting every OWNER target is stronger than (and implies)
 * the BR-WS-002 "at least one OWNER" invariant.
 */
export async function removeMember(
  workspaceId: string,
  actorRole: TeamRole,
  membershipId: string
): Promise<TeamMutationResult<null>> {
  const parsed = membershipIdSchema.safeParse(membershipId);
  if (!parsed.success) {
    return { ok: false, code: "invalid_input" };
  }

  const target = await findScopedMembership(workspaceId, parsed.data);
  if (!target) {
    return { ok: false, code: "not_found" };
  }

  if (actorRole !== "OWNER") {
    return { ok: false, code: "unauthorized" };
  }

  if (target.role === "OWNER") {
    return { ok: false, code: "cannot_remove_owner" };
  }

  const result = await prisma.membership.deleteMany({
    where: { id: target.id, workspaceId },
  });
  if (result.count === 0) {
    return { ok: false, code: "not_found" };
  }
  return { ok: true, value: null };
}