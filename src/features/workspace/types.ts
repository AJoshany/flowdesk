/** Mirrors the `Role` enum in prisma/schema.prisma. */
export type WorkspaceRole = "OWNER" | "MANAGER" | "MEMBER";

/**
 * A resolved workspace membership: which workspace the user belongs to and
 * which role they hold *in that workspace*. The role is workspace-scoped —
 * it never implies the same role in another workspace.
 */
export type WorkspaceMembership = {
  workspaceId: string;
  role: WorkspaceRole;
};
