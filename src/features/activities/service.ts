import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { activityFieldsSchema, type ActivityFieldsInput } from "./schemas";

/**
 * Activity data access (server-only).
 *
 * AUTHORIZATION BOUNDARY (BR-ACT-005, docs/architecture/database.md §10):
 * every query is scoped by the authorized `workspaceId`, which callers MUST
 * resolve server-side from the session workspace context (never from client
 * input). Activity rows are never read "by id only" — the scoped list
 * helpers additionally constrain by the resource id, so a customer or deal
 * from another workspace simply has no activities (no disclosure).
 *
 * ASSOCIATIONS (BR-ACT-002/003/004, docs/architecture/database.md §8): an
 * activity may reference a customer and/or a deal. Each reference must exist
 * in the SAME workspace as the activity; otherwise the association is
 * rejected (`invalid_reference`). A well-formed but foreign id fails this
 * scoped check — the client can never link an activity to another
 * workspace's customer or deal.
 */

const activitySelect = {
  id: true,
  note: true,
  customerId: true,
  dealId: true,
  workspaceId: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { id: true, name: true } },
  deal: { select: { id: true, title: true } },
} as const;

export type Activity = Prisma.ActivityGetPayload<{
  select: typeof activitySelect;
}>;

export type ActivityMutationResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: "invalid_input" | "invalid_reference" };

async function resourceExistsInWorkspace(
  kind: "customer" | "deal",
  workspaceId: string,
  resourceId: string
): Promise<boolean> {
  const row =
    kind === "customer"
      ? await prisma.customer.findFirst({
          where: { id: resourceId, workspaceId },
          select: { id: true },
        })
      : await prisma.deal.findFirst({
          where: { id: resourceId, workspaceId },
          select: { id: true },
        });
  return row !== null;
}

/** Recent workspace activity feed, newest first (REQ-ACT-003). */
export async function listActivities(workspaceId: string): Promise<Activity[]> {
  return prisma.activity.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    select: activitySelect,
  });
}

/**
 * The `take` most recent workspace activities, newest first (REQ-DASH-004).
 *
 * Used by the Dashboard for the activity overview without loading the full
 * feed. Scoped to `workspaceId` like every other activity read (BR-ACT-005).
 */
export async function listRecentActivities(
  workspaceId: string,
  take: number
): Promise<Activity[]> {
  return prisma.activity.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take,
    select: activitySelect,
  });
}

/** Activities associated with a customer (AC-ACT-002), newest first. */
export async function listActivitiesForCustomer(
  workspaceId: string,
  customerId: string
): Promise<Activity[]> {
  return prisma.activity.findMany({
    where: { workspaceId, customerId },
    orderBy: { createdAt: "desc" },
    select: activitySelect,
  });
}

/** Activities associated with a deal (AC-ACT-003), newest first. */
export async function listActivitiesForDeal(
  workspaceId: string,
  dealId: string
): Promise<Activity[]> {
  return prisma.activity.findMany({
    where: { workspaceId, dealId },
    orderBy: { createdAt: "desc" },
    select: activitySelect,
  });
}

/** Creates an activity under `workspaceId` (AC-ACT-001). */
export async function createActivity(
  workspaceId: string,
  input: ActivityFieldsInput
): Promise<ActivityMutationResult<Activity>> {
  const parsed = activityFieldsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "invalid_input" };
  }

  if (
    parsed.data.customerId &&
    !(await resourceExistsInWorkspace(
      "customer",
      workspaceId,
      parsed.data.customerId
    ))
  ) {
    return { ok: false, code: "invalid_reference" };
  }
  if (
    parsed.data.dealId &&
    !(await resourceExistsInWorkspace("deal", workspaceId, parsed.data.dealId))
  ) {
    return { ok: false, code: "invalid_reference" };
  }

  const activity = await prisma.activity.create({
    data: {
      note: parsed.data.note,
      customerId: parsed.data.customerId,
      dealId: parsed.data.dealId,
      workspaceId,
    },
    select: activitySelect,
  });
  return { ok: true, value: activity };
}
