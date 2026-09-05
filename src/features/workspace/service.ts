import { prisma } from "@/lib/prisma";
import type { WorkspaceMembership } from "./types";

/**
 * Workspace membership data access (server-only; Prisma is never imported by
 * client components).
 *
 * Every query is keyed by the (userId, workspaceId) pair: the caller supplies
 * a `userId` resolved exclusively from the server-side session, and the
 * `workspaceId` of the workspace the operation concerns. Nothing is ever
 * queried "by resource id only" (docs/architecture/database.md §10), so a user
 * can only resolve memberships they actually hold.
 */

/**
 * Resolves the membership of `userId` in `workspaceId`.
 *
 * Returns only `{ workspaceId, role }` — never other workspace data — or
 * `null` when the user is not a member or the workspace does not exist.
 */
export async function findWorkspaceMembership(
  userId: string,
  workspaceId: string
): Promise<WorkspaceMembership | null> {
  if (!workspaceId) {
    return null;
  }
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    select: { role: true },
  });
  if (!membership) {
    return null;
  }
  return { workspaceId, role: membership.role };
}

/**
 * Number of OWNER memberships in a workspace (BR-WS-002: every workspace must
 * have at least one OWNER).
 *
 * The only membership-creation flow in the MVP (registration) always creates
 * an OWNER, so the invariant holds by construction today. Future mutations
 * (e.g. Team member removal / role changes) must use this check so they never
 * remove the last OWNER of a workspace.
 */
export async function countWorkspaceOwners(workspaceId: string): Promise<number> {
  if (!workspaceId) {
    return 0;
  }
  return prisma.membership.count({
    where: { workspaceId, role: "OWNER" },
  });
}
