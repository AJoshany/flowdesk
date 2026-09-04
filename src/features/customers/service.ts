import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createCustomerSchema, updateCustomerSchema, type CustomerFieldsInput } from "./schemas";

/**
 * Customer data access (server-only).
 *
 * AUTHORIZATION BOUNDARY: every query is scoped by the authorized
 * `workspaceId`, which callers MUST resolve server-side from the session
 * workspace context (never from client input). A customer is never queried
 * "by id only" (docs/architecture/database.md §10) — reads, updates and
 * deletes all carry `workspaceId` in the WHERE clause, so a customer from
 * another workspace is indistinguishable from a missing one.
 */

const customerSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  company: true,
  workspaceId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type Customer = Prisma.CustomerGetPayload<{ select: typeof customerSelect }>;

export type CustomerMutationResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: "invalid_input" | "duplicate" | "not_found" | "conflict" };

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/** All customers belonging to `workspaceId`, newest first. */
export async function listCustomers(workspaceId: string): Promise<Customer[]> {
  return prisma.customer.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    select: customerSelect,
  });
}

/** A single customer — only when it belongs to `workspaceId`. */
export async function getCustomerById(
  workspaceId: string,
  customerId: string
): Promise<Customer | null> {
  return prisma.customer.findFirst({
    where: { id: customerId, workspaceId },
    select: customerSelect,
  });
}

/** Creates a customer under `workspaceId` (AC-CUST-002). */
export async function createCustomer(
  workspaceId: string,
  input: CustomerFieldsInput
): Promise<CustomerMutationResult<Customer>> {
  const parsed = createCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "invalid_input" };
  }
  try {
    const customer = await prisma.customer.create({
      data: { ...parsed.data, workspaceId },
      select: customerSelect,
    });
    return { ok: true, value: customer };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { ok: false, code: "duplicate" };
    }
    throw error;
  }
}

/**
 * Updates a customer in `workspaceId` (AC-CUST-003).
 *
 * Optimistic concurrency: when `expectedUpdatedAt` does not match the stored
 * row, a conflict is returned so the client can reload instead of silently
 * overwriting a concurrent edit (spec §9 edge case).
 */
export async function updateCustomer(
  workspaceId: string,
  customerId: string,
  input: CustomerFieldsInput,
  expectedUpdatedAt: Date
): Promise<CustomerMutationResult<Customer>> {
  const parsed = updateCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "invalid_input" };
  }

  const current = await getCustomerById(workspaceId, customerId);
  if (!current) {
    return { ok: false, code: "not_found" };
  }
  if (current.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
    return { ok: false, code: "conflict" };
  }

  try {
    // The write carries the workspace boundary in its WHERE clause.
    const result = await prisma.customer.updateMany({
      where: { id: customerId, workspaceId },
      data: parsed.data,
    });
    if (result.count === 0) {
      return { ok: false, code: "not_found" };
    }
    const customer = await getCustomerById(workspaceId, customerId);
    if (!customer) {
      return { ok: false, code: "not_found" };
    }
    return { ok: true, value: customer };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { ok: false, code: "duplicate" };
    }
    throw error;
  }
}

/**
 * Deletes a customer in `workspaceId`. A missing customer and a foreign
 * workspace's customer are both reported as `not_found` (no disclosure).
 * Role authorization (OWNER/MANAGER only) is enforced by the caller.
 */
export async function deleteCustomer(
  workspaceId: string,
  customerId: string
): Promise<CustomerMutationResult<null>> {
  const result = await prisma.customer.deleteMany({
    where: { id: customerId, workspaceId },
  });
  if (result.count === 0) {
    return { ok: false, code: "not_found" };
  }
  return { ok: true, value: null };
}