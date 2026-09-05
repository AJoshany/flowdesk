"use server";

import { redirect } from "next/navigation";
import type { ZodError } from "zod";
import { requireSessionWorkspace } from "@/features/workspace/session-workspace";
import {
  ACTIVITY_GENERIC_ERROR_MESSAGE,
  ACTIVITY_INVALID_REFERENCE_MESSAGE,
  ACTIVITY_VALIDATION_MESSAGE,
} from "./messages";
import { activityFieldsSchema } from "./schemas";
import { createActivity, type ActivityMutationResult } from "./service";

export type ActivityFormState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
} | null;

function fieldErrorsFromZod(
  error: ZodError
): Record<string, string[] | undefined> {
  return error.flatten().fieldErrors as Record<string, string[] | undefined>;
}

function readActivityFields(formData: FormData) {
  return {
    note: formData.get("note"),
    customerId: formData.get("customerId"),
    dealId: formData.get("dealId"),
  };
}

type FailedMutation = Extract<ActivityMutationResult<unknown>, { ok: false }>;

function mapMutationError(result: FailedMutation): string {
  switch (result.code) {
    case "invalid_reference":
      return ACTIVITY_INVALID_REFERENCE_MESSAGE;
    default:
      return ACTIVITY_GENERIC_ERROR_MESSAGE;
  }
}

/**
 * Create an activity (REQ-ACT-001, AC-ACT-001).
 *
 * The spec defines no editing or deletion for activities and roles-permissions
 * grants "Create Activity" to every workspace role, so this is the only
 * activity action. The workspace id comes exclusively from the
 * server-resolved session workspace — any client-supplied workspace identity
 * is ignored, and customer/deal associations are validated inside that
 * workspace by the service.
 */
export async function createActivityAction(
  _prevState: ActivityFormState,
  formData: FormData
): Promise<ActivityFormState> {
  const parsed = activityFieldsSchema.safeParse(readActivityFields(formData));
  if (!parsed.success) {
    return {
      error: ACTIVITY_VALIDATION_MESSAGE,
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const { workspace } = await requireSessionWorkspace();
  const result = await createActivity(workspace.workspaceId, parsed.data);
  if (!result.ok) {
    return { error: mapMutationError(result) };
  }

  redirect("/activities");
}
