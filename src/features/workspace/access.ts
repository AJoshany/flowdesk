import { notFound } from "next/navigation";
import { findWorkspaceMembership } from "./service";
import type { WorkspaceMembership } from "./types";

/**
 * Workspace authorization boundary (BR-WS-004/005, docs/architecture/database.md §10).
 *
 * `requireWorkspaceAccess(userId, workspaceId)` grants access to a workspace
 * ONLY when the user (whose id must come from the server-side session, never
 * from the client) holds a membership in that workspace. It is the guard every
 * workspace-scoped operation must go through — never "query by client-provided
 * id only".
 *
 * Denial policy:
 * - Unauthenticated users are handled upstream (middleware + auth session
 *   helpers redirect to /login).
 * - An *authenticated* user without membership in the target workspace is
 *   denied with a 404 (`notFound()`): no login loop, and no disclosure of
 *   whether the workspace exists.
 *
 * The role is never an input to this function — it is read from the
 * membership row, so a client can never change or assert a role (BR-WS role
 * is workspace-scoped and server-resolved).
 */
export async function requireWorkspaceAccess(
  userId: string,
  workspaceId: string
): Promise<WorkspaceMembership> {
  const membership = await findWorkspaceMembership(userId, workspaceId);
  if (!membership) {
    notFound();
  }
  return membership;
}
