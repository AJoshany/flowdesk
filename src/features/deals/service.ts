import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createDealSchema,
  updateDealSchema,
  type DealFieldsInput,
} from "./schemas";

/**
 * Deal data access (server-only).
 *
 * AUTHORIZATION BOUNDARY (BR-DEAL-006, docs/architecture/database.md §10):
 * every query is scoped by the authorized `workspaceId`, which callers MUST
 * resolve server-side from the session workspace context (never from client
 * input). A deal is never queried "by id only" — reads, updates and deletes
 * all carry `workspaceId` in the WHERE clause, so a deal from another
 * workspace is indistinguishable from a missing one.
 *
 * CUSTOMER ASSOCIATION (BR-DEAL-002): when input carries a `customerId`, the
 * customer must exist in the SAME workspace as the deal; otherwise the
 * association is rejected (`invalid_customer`). A well-formed but foreign
 * customer id fails this scoped check — the client can never link a deal to a
 * customer of another workspace.
 */

const dealSelect = {
  id: true,
  title: true,
  stage: true,
  customerId: true,
  workspaceId: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { id: true, name: true } },
} as const;

export type Deal = Prisma.DealGetPayload<{ select: typeof dealSelect }>;

export type DealMutationResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      code: "invalid_input" | "invalid_customer" | "not_found" | "conflict";
    };

async function customerExistsInWorkspace(
  workspaceId: string,
  customerId: string
): Promise<boolean> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, workspaceId },
    select: { id: true },
  });
  return customer !== null;
}

/** All deals belonging to `workspaceId`, newest first (AC-DEAL-001). */
export async function listDeals(workspaceId: string): Promise<Deal[]> {
  return prisma.deal.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    select: dealSelect,
  });
}

/** A single deal — only when it belongs to `workspaceId`. */
export async function getDealById(
  workspaceId: string,
  dealId: string
): Promise<Deal | null> {
  return prisma.deal.findFirst({
    where: { id: dealId, workspaceId },
    select: dealSelect,
  });
}

/** Creates a deal under `workspaceId` (AC-DEAL-002). */
export async function createDeal(
  workspaceId: string,
  input: DealFieldsInput
): Promise<DealMutationResult<Deal>> {
  const parsed = createDealSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "invalid_input" };
  }
  if (
    parsed.data.customerId &&
    !(await customerExistsInWorkspace(workspaceId, parsed.data.customerId))
  ) {
    return { ok: false, code: "invalid_customer" };
  }

  const deal = await prisma.deal.create({
    data: {
      title: parsed.data.title,
      stage: parsed.data.stage,
      customerId: parsed.data.customerId,
      workspaceId,
    },
    select: dealSelect,
  });
  return { ok: true, value: deal };
}

/**
 * Updates a deal in `workspaceId` (AC-DEAL-003 — the stage is part of the
 * form, so changing the stage persists it).
 *
 * Optimistic concurrency: when `expectedUpdatedAt` does not match the stored
 * row, a conflict is returned so the client can reload instead of silently
 * overwriting a concurrent edit.
 */
export async function updateDeal(
  workspaceId: string,
  dealId: string,
  input: DealFieldsInput,
  expectedUpdatedAt: Date
): Promise<DealMutationResult<Deal>> {
  const parsed = updateDealSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "invalid_input" };
  }

  const current = await getDealById(workspaceId, dealId);
  if (!current) {
    return { ok: false, code: "not_found" };
  }
  if (current.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
    return { ok: false, code: "conflict" };
  }
  if (
    parsed.data.customerId &&
    !(await customerExistsInWorkspace(workspaceId, parsed.data.customerId))
  ) {
    return { ok: false, code: "invalid_customer" };
  }

  // The write carries the workspace boundary in its WHERE clause.
  const result = await prisma.deal.updateMany({
    where: { id: dealId, workspaceId },
    data: {
      title: parsed.data.title,
      stage: parsed.data.stage,
      customerId: parsed.data.customerId,
    },
  });
  if (result.count === 0) {
    return { ok: false, code: "not_found" };
  }
  const deal = await getDealById(workspaceId, dealId);
  if (!deal) {
    return { ok: false, code: "not_found" };
  }
  return { ok: true, value: deal };
}

/**
 * Deletes a deal in `workspaceId`. A missing deal and a foreign workspace's
 * deal are both reported as `not_found` (no disclosure). Role authorization
 * (OWNER/MANAGER only, BR-DEAL-004/005) is enforced by the caller.
 */
export async function deleteDeal(
  workspaceId: string,
  dealId: string
): Promise<DealMutationResult<null>> {
  const result = await prisma.deal.deleteMany({
    where: { id: dealId, workspaceId },
  });
  if (result.count === 0) {
    return { ok: false, code: "not_found" };
  }
  return { ok: true, value: null };
}
