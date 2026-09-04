"use server";

import { redirect } from "next/navigation";
import type { ZodError } from "zod";
import { requireSessionWorkspace } from "@/features/workspace/session-workspace";
import {
  DEAL_CONFLICT_MESSAGE,
  DEAL_GENERIC_ERROR_MESSAGE,
  DEAL_INVALID_CUSTOMER_MESSAGE,
  DEAL_NOT_FOUND_MESSAGE,
  DEAL_UNAUTHORIZED_DELETE_MESSAGE,
  DEAL_VALIDATION_MESSAGE,
} from "./messages";
import {
  createDealSchema,
  dealIdSchema,
  expectedUpdatedAtSchema,
  updateDealSchema,
} from "./schemas";
import {
  createDeal,
  deleteDeal,
  updateDeal,
  type DealMutationResult,
} from "./service";

export type DealFormState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
} | null;

function fieldErrorsFromZod(
  error: ZodError
): Record<string, string[] | undefined> {
  return error.flatten().fieldErrors as Record<string, string[] | undefined>;
}

function readDealFields(formData: FormData) {
  return {
    title: formData.get("title"),
    stage: formData.get("stage"),
    customerId: formData.get("customerId"),
  };
}

type FailedMutation = Extract<DealMutationResult<unknown>, { ok: false }>;

function mapMutationError(result: FailedMutation): string {
  switch (result.code) {
    case "invalid_customer":
      return DEAL_INVALID_CUSTOMER_MESSAGE;
    case "not_found":
      return DEAL_NOT_FOUND_MESSAGE;
    case "conflict":
      return DEAL_CONFLICT_MESSAGE;
    default:
      return DEAL_GENERIC_ERROR_MESSAGE;
  }
}

/**
 * Create a deal (AC-DEAL-002).
 *
 * The workspace id comes exclusively from the server-resolved session
 * workspace — any client-supplied workspace identity is ignored. The
 * authenticated user must be a workspace member (requireSessionWorkspace).
 */
export async function createDealAction(
  _prevState: DealFormState,
  formData: FormData
): Promise<DealFormState> {
  const parsed = createDealSchema.safeParse(readDealFields(formData));
  if (!parsed.success) {
    return {
      error: DEAL_VALIDATION_MESSAGE,
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const { workspace } = await requireSessionWorkspace();
  const result = await createDeal(workspace.workspaceId, parsed.data);
  if (!result.ok) {
    return { error: mapMutationError(result) };
  }

  redirect(`/deals/${result.value.id}`);
}

/**
 * Update a deal (AC-DEAL-003 — the stage is editable here), with optimistic
 * concurrency control via the hidden `expectedUpdatedAt` field.
 */
export async function updateDealAction(
  _prevState: DealFormState,
  formData: FormData
): Promise<DealFormState> {
  const dealId = dealIdSchema.safeParse(formData.get("dealId"));
  if (!dealId.success) {
    return {
      error: DEAL_VALIDATION_MESSAGE,
      fieldErrors: { dealId: dealId.error.flatten().formErrors },
    };
  }

  const fields = updateDealSchema.safeParse(readDealFields(formData));
  if (!fields.success) {
    return {
      error: DEAL_VALIDATION_MESSAGE,
      fieldErrors: fieldErrorsFromZod(fields.error),
    };
  }

  const expectedUpdatedAt = expectedUpdatedAtSchema.safeParse(
    formData.get("expectedUpdatedAt")
  );
  if (!expectedUpdatedAt.success) {
    return { error: DEAL_CONFLICT_MESSAGE };
  }

  const { workspace } = await requireSessionWorkspace();
  const result = await updateDeal(
    workspace.workspaceId,
    dealId.data,
    fields.data,
    expectedUpdatedAt.data
  );
  if (!result.ok) {
    return { error: mapMutationError(result) };
  }

  redirect(`/deals/${dealId.data}`);
}

/**
 * Delete a deal (AC-DEAL-004/005).
 *
 * Role is resolved server-side from the session workspace context. MEMBER is
 * rejected BEFORE any data access — the UI hiding the button is not the
 * security boundary.
 */
export async function deleteDealAction(
  _prevState: DealFormState,
  formData: FormData
): Promise<DealFormState> {
  const dealId = dealIdSchema.safeParse(formData.get("dealId"));
  if (!dealId.success) {
    return { error: DEAL_NOT_FOUND_MESSAGE };
  }

  const { workspace } = await requireSessionWorkspace();
  if (workspace.role === "MEMBER") {
    return { error: DEAL_UNAUTHORIZED_DELETE_MESSAGE };
  }

  // Scoped delete: a foreign or missing deal is reported as not found.
  const result = await deleteDeal(workspace.workspaceId, dealId.data);
  if (!result.ok && result.code !== "not_found") {
    return { error: mapMutationError(result) };
  }

  redirect("/deals");
}
