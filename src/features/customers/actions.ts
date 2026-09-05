"use server";

import { redirect } from "next/navigation";
import type { ZodError } from "zod";
import { requireSessionWorkspace } from "@/features/workspace/session-workspace";
import {
  CUSTOMER_CONFLICT_MESSAGE,
  CUSTOMER_DUPLICATE_MESSAGE,
  CUSTOMER_GENERIC_ERROR_MESSAGE,
  CUSTOMER_NOT_FOUND_MESSAGE,
  CUSTOMER_UNAUTHORIZED_DELETE_MESSAGE,
  CUSTOMER_VALIDATION_MESSAGE,
} from "./messages";
import {
  createCustomerSchema,
  customerIdSchema,
  expectedUpdatedAtSchema,
  updateCustomerSchema,
} from "./schemas";
import {
  createCustomer,
  deleteCustomer,
  updateCustomer,
  type CustomerMutationResult,
} from "./service";

export type CustomerFormState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
} | null;

function fieldErrorsFromZod(
  error: ZodError
): Record<string, string[] | undefined> {
  return error.flatten().fieldErrors as Record<string, string[] | undefined>;
}

function readCustomerFields(formData: FormData) {
  return {
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    company: formData.get("company"),
  };
}

type FailedMutation = Extract<CustomerMutationResult<unknown>, { ok: false }>;

function mapMutationError(result: FailedMutation): string {
  switch (result.code) {
    case "duplicate":
      return CUSTOMER_DUPLICATE_MESSAGE;
    case "not_found":
      return CUSTOMER_NOT_FOUND_MESSAGE;
    case "conflict":
      return CUSTOMER_CONFLICT_MESSAGE;
    default:
      return CUSTOMER_GENERIC_ERROR_MESSAGE;
  }
}

/**
 * Create a customer (AC-CUST-002).
 *
 * The workspace id comes exclusively from the server-resolved session
 * workspace — any client-supplied workspace identity is ignored. The
 * authenticated user must be a workspace member (requireSessionWorkspace).
 */
export async function createCustomerAction(
  _prevState: CustomerFormState,
  formData: FormData
): Promise<CustomerFormState> {
  const parsed = createCustomerSchema.safeParse(readCustomerFields(formData));
  if (!parsed.success) {
    return {
      error: CUSTOMER_VALIDATION_MESSAGE,
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const { workspace } = await requireSessionWorkspace();
  const result = await createCustomer(workspace.workspaceId, parsed.data);
  if (!result.ok) {
    return { error: mapMutationError(result) };
  }

  redirect(`/customers/${result.value.id}`);
}

/**
 * Update a customer (AC-CUST-003), with optimistic concurrency control via the
 * hidden `expectedUpdatedAt` field.
 */
export async function updateCustomerAction(
  _prevState: CustomerFormState,
  formData: FormData
): Promise<CustomerFormState> {
  const customerId = customerIdSchema.safeParse(formData.get("customerId"));
  if (!customerId.success) {
    return {
      error: CUSTOMER_VALIDATION_MESSAGE,
      fieldErrors: { customerId: customerId.error.flatten().formErrors },
    };
  }

  const fields = updateCustomerSchema.safeParse(readCustomerFields(formData));
  if (!fields.success) {
    return {
      error: CUSTOMER_VALIDATION_MESSAGE,
      fieldErrors: fieldErrorsFromZod(fields.error),
    };
  }

  const expectedUpdatedAt = expectedUpdatedAtSchema.safeParse(
    formData.get("expectedUpdatedAt")
  );
  if (!expectedUpdatedAt.success) {
    return { error: CUSTOMER_CONFLICT_MESSAGE };
  }

  const { workspace } = await requireSessionWorkspace();
  const result = await updateCustomer(
    workspace.workspaceId,
    customerId.data,
    fields.data,
    expectedUpdatedAt.data
  );
  if (!result.ok) {
    return { error: mapMutationError(result) };
  }

  redirect(`/customers/${customerId.data}`);
}

/**
 * Delete a customer (AC-CUST-004/005).
 *
 * Role is resolved server-side from the session workspace context. MEMBER is
 * rejected BEFORE any data access — the UI hiding the button is not the
 * security boundary.
 */
export async function deleteCustomerAction(
  _prevState: CustomerFormState,
  formData: FormData
): Promise<CustomerFormState> {
  const customerId = customerIdSchema.safeParse(formData.get("customerId"));
  if (!customerId.success) {
    return { error: CUSTOMER_NOT_FOUND_MESSAGE };
  }

  const { workspace } = await requireSessionWorkspace();
  if (workspace.role === "MEMBER") {
    return { error: CUSTOMER_UNAUTHORIZED_DELETE_MESSAGE };
  }

  // Scoped delete: a foreign or missing customer is reported as not found.
  const result = await deleteCustomer(workspace.workspaceId, customerId.data);
  if (!result.ok && result.code !== "not_found") {
    return { error: mapMutationError(result) };
  }

  redirect("/customers");
}