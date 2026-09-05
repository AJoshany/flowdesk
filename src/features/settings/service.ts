import { prisma } from "@/lib/prisma";
import type { WorkspaceRole } from "@/features/workspace/types";
import { workspaceNameSchema } from "./schemas";

/**
 * Settings data access and authorization rules (server-only).
 *
 * Every read is scoped by the authorized `workspaceId` and the `userId`
 * resolved from the server-side session — a client can never ask for another
 * workspace's or another user's settings (docs/architecture/database.md §10).
 *
 * Renaming a workspace is a workspace-management operation: only an OWNER may
 * change it ("Manage workspace access" is OWNER-only in the permission
 * matrix, docs/product/roles-permissions.md §3/§6). The role comes from the
 * server-resolved membership, never from client input.
 */

export type WorkspaceSettings = {
  name: string;
  createdAt: Date;
  /** Members of the workspace (including the current user). */
  memberCount: number;
  /** When the current user joined this workspace. */
  joinedAt: Date;
};

export type SettingsMutationResult =
  | { ok: true; value: { name: string } }
  | { ok: false; code: "invalid_input" | "unauthorized" | "not_found" };

/**
 * Settings overview for the authenticated member's own workspace.
 *
 * Returns `null` when the workspace does not exist or the user is not a
 * member — no existence disclosure.
 */
export async function getWorkspaceSettings(
  workspaceId: string,
  userId: string
): Promise<WorkspaceSettings | null> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      name: true,
      createdAt: true,
      _count: { select: { memberships: true } },
    },
  });
  if (!workspace) {
    return null;
  }

  // Scoped by (userId, workspaceId) so the membership is the caller's own.
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    select: { createdAt: true },
  });
  if (!membership) {
    return null;
  }

  return {
    name: workspace.name,
    createdAt: workspace.createdAt,
    memberCount: workspace._count.memberships,
    joinedAt: membership.createdAt,
  };
}

/**
 * Renames the workspace (OWNER-only).
 *
 * The update carries the workspace id in its WHERE clause, so a missing or
 * foreign workspace reports `not_found` — no disclosure.
 */
export async function renameWorkspace(
  workspaceId: string,
  actorRole: WorkspaceRole,
  input: unknown
): Promise<SettingsMutationResult> {
  const parsed = workspaceNameSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "invalid_input" };
  }

  if (actorRole !== "OWNER") {
    return { ok: false, code: "unauthorized" };
  }

  const result = await prisma.workspace.updateMany({
    where: { id: workspaceId },
    data: { name: parsed.data },
  });
  if (result.count === 0) {
    return { ok: false, code: "not_found" };
  }

  return { ok: true, value: { name: parsed.data } };
}