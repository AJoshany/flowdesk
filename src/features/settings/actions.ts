"use server";

import { redirect } from "next/navigation";
import type { ZodError } from "zod";
import { requireSessionWorkspace } from "@/features/workspace/session-workspace";
import {
  SETTINGS_GENERIC_ERROR_MESSAGE,
  SETTINGS_RENAME_UNAUTHORIZED_MESSAGE,
  SETTINGS_VALIDATION_MESSAGE,
} from "./messages";
import { workspaceNameSchema } from "./schemas";
import { renameWorkspace } from "./service";

export type SettingsFormState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
} | null;

function fieldErrorsFromZod(
  error: ZodError
): Record<string, string[] | undefined> {
  return error.flatten().fieldErrors as Record<string, string[] | undefined>;
}

/**
 * Renames the workspace (OWNER-only).
 *
 * The workspace id and actor role come exclusively from the server-resolved
 * session workspace — any client-supplied identity or role is ignored. A
 * non-OWNER caller is rejected by the service before any write.
 */
export async function renameWorkspaceAction(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const parsed = workspaceNameSchema.safeParse(formData.get("name"));
  if (!parsed.success) {
    return {
      error: SETTINGS_VALIDATION_MESSAGE,
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const { workspace } = await requireSessionWorkspace();
  const result = await renameWorkspace(
    workspace.workspaceId,
    workspace.role,
    parsed.data
  );
  if (!result.ok) {
    switch (result.code) {
      case "unauthorized":
        return { error: SETTINGS_RENAME_UNAUTHORIZED_MESSAGE };
      case "invalid_input":
        return { error: SETTINGS_VALIDATION_MESSAGE };
      default:
        return { error: SETTINGS_GENERIC_ERROR_MESSAGE };
    }
  }

  redirect("/settings");
}