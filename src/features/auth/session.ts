import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export type SessionUser = { id: string; email: string };

export type WorkspaceContext = {
  workspaceId: string;
  workspaceName: string;
  role: "OWNER" | "MANAGER" | "MEMBER";
};

/**
 * Returns the authenticated user ({ id, email }) resolved from the Auth.js
 * session, or null. Identity always comes from the server-side session —
 * never from client-provided values (BR-AUTH-005).
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) {
    return null;
  }
  // A decodable JWT is not proof the account still exists: the virtual dev DB
  // can be re-provisioned or a user removed server-side while their session
  // cookie remains valid. Verify the id still resolves so a stale session
  // behaves like a signed-out visitor (redirect to /login) instead of 404ing
  // protected pages. The page-level 404 remains reserved for users that exist
  // but hold no workspace membership (AC-WS-002).
  const existing = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true },
  });
  if (!existing) {
    return null;
  }
  return { id: user.id, email: user.email ?? "" };
}

/**
 * Like getCurrentUser, but redirects unauthenticated visitors to /login.
 * Used by server components that render protected areas.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

/**
 * Resolves the user's workspace context (membership + workspace) server-side.
 *
 * Multi-workspace UX is out of scope for the MVP, so the first membership
 * (created at registration) is treated as the user's workspace context.
 * Memberships are always resolved from the authenticated user's id — a
 * client-supplied workspace/user id is never used as the query key.
 */
async function resolvePrimaryWorkspaceContext(userId: string): Promise<WorkspaceContext | null> {
  const membership = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { workspace: { select: { id: true, name: true } } },
  });
  if (!membership) {
    return null;
  }
  return {
    workspaceId: membership.workspace.id,
    workspaceName: membership.workspace.name,
    role: membership.role,
  };
}

/** Alias kept for callers that read workspace context. */
export async function getWorkspaceContext(
  userId: string
): Promise<WorkspaceContext | null> {
  return resolvePrimaryWorkspaceContext(userId);
}

/**
 * Workspace-isolation boundary (BR-AUTH-004, REQ-WS-003).
 *
 * - `getWorkspaceContext(userId)`: primary membership context.
 * - `requireWorkspaceMembership(userId, workspaceId?)`: ensures the
 *   authenticated user is a member of the given (or their primary) workspace
 *   and returns the workspace context; redirects to /login when the user has
 *   no such membership.
 *
 * Future workspace-scoped operations must go through this boundary — never
 * "query by client-provided id only" (docs/architecture/database.md §10).
 */
export async function requireWorkspaceMembership(
  userId: string,
  workspaceId?: string
): Promise<WorkspaceContext> {
  let context: WorkspaceContext | null = null;
  if (workspaceId) {
    const membership = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
      include: { workspace: { select: { id: true, name: true } } },
    });
    if (membership) {
      context = {
        workspaceId: membership.workspace.id,
        workspaceName: membership.workspace.name,
        role: membership.role,
      };
    }
  } else {
    context = await resolvePrimaryWorkspaceContext(userId);
  }

  if (!context) {
    redirect("/login");
  }
  return context;
}
