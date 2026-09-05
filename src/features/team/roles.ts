/**
 * Workspace roles (docs/features/team.md BR-TEAM-003; mirrors the `Role`
 * enum in prisma/schema.prisma). The array order is the display order.
 */
export const TEAM_ROLES = ["OWNER", "MANAGER", "MEMBER"] as const;

export type TeamRole = (typeof TEAM_ROLES)[number];

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  MEMBER: "Member",
};