import { prisma } from "@/lib/prisma";
import { listRecentActivities, type Activity } from "@/features/activities/service";
import { DEAL_STAGES, type DealStage } from "@/features/deals/stages";

/**
 * Dashboard data access (server-only) — the aggregation/read layer over the
 * existing domain functionality (docs/plans/dashboard.md).
 *
 * AUTHORIZATION BOUNDARY: every query is keyed by the authorized
 * `workspaceId`, which callers MUST resolve server-side from the session
 * workspace context (`requireSessionWorkspace`) — never from client input.
 * The dashboard accepts no query parameters and no client-supplied identity,
 * so a client-provided workspace/user/role can never reach this module
 * (REQ-GEN-001, BR-AUTH-005).
 *
 * Aggregations are database-side (`count` / `groupBy`) — nothing is loaded
 * into memory — and the independent queries run in parallel.
 */

/** How many recent activities the dashboard shows (REQ-DASH-004). */
export const RECENT_ACTIVITIES_LIMIT = 5;

export type DashboardData = {
  customerCount: number;
  dealCount: number;
  activityCount: number;
  memberCount: number;
  /** Deal count per pipeline stage, zero-filled for every stage. */
  dealsByStage: Record<DealStage, number>;
  recentActivities: Activity[];
};

/**
 * Resolves the complete dashboard overview for `workspaceId` (REQ-DASH-002,
 * REQ-DASH-003, REQ-DASH-004). Only data of the given workspace is ever
 * included — customers, deals, activities, and members from any other
 * workspace are invisible.
 */
export async function getDashboardData(
  workspaceId: string
): Promise<DashboardData> {
  const [customerCount, dealCount, activityCount, memberCount, stageGroups, recentActivities] =
    await Promise.all([
      prisma.customer.count({ where: { workspaceId } }),
      prisma.deal.count({ where: { workspaceId } }),
      prisma.activity.count({ where: { workspaceId } }),
      prisma.membership.count({ where: { workspaceId } }),
      prisma.deal.groupBy({
        by: ["stage"],
        where: { workspaceId },
        _count: { _all: true },
      }),
      listRecentActivities(workspaceId, RECENT_ACTIVITIES_LIMIT),
    ]);

  const dealsByStage = Object.fromEntries(
    DEAL_STAGES.map((stage) => [stage, 0])
  ) as Record<DealStage, number>;
  for (const group of stageGroups) {
    dealsByStage[group.stage] = group._count._all;
  }

  return {
    customerCount,
    dealCount,
    activityCount,
    memberCount,
    dealsByStage,
    recentActivities,
  };
}