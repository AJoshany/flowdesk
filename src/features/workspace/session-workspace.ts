import { notFound } from "next/navigation";
import {
  getCurrentUser,
  getWorkspaceContext,
  requireUser,
  type SessionUser,
  type WorkspaceContext,
} from "@/features/auth/session";

/**
 * Composes the authenticated session with the user's primary workspace
 * context for server components (docs/architecture/authentication.md §11:
 * a valid session does not by itself grant workspace access).
 *
 * Both identity and membership are resolved server-side from the session;
 * nothing here is derived from client input.
 */

export type SessionWorkspace = {
  user: SessionUser;
  workspace: WorkspaceContext;
};

/**
 * Returns `{ user, workspace }` for an authenticated member, or `null` when
 * the visitor is unauthenticated or has no workspace membership.
 */
export async function getSessionWorkspace(): Promise<SessionWorkspace | null> {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }
  const workspace = await getWorkspaceContext(user.id);
  if (!workspace) {
    return null;
  }
  return { user, workspace };
}

/**
 * Like `getSessionWorkspace`, but enforces access:
 * - unauthenticated → redirect to /login (delegated to auth's `requireUser`);
 * - authenticated user with no workspace membership → denied (404) so they
 *   never see the protected application shell (AC-WS-002).
 */
export async function requireSessionWorkspace(): Promise<SessionWorkspace> {
  const user = await requireUser();
  const workspace = await getWorkspaceContext(user.id);
  if (!workspace) {
    notFound();
  }
  return { user, workspace };
}
