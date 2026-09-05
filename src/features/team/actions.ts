"use server";

import { redirect } from "next/navigation";
import type { ZodError } from "zod";
import { requireSessionWorkspace } from "@/features/workspace/session-workspace";
import {
  TEAM_ALREADY_MEMBER_MESSAGE,
  TEAM_CANNOT_ASSIGN_OWNER_ROLE_MESSAGE,
  TEAM_CANNOT_CHANGE_OWN_ROLE_MESSAGE,
  TEAM_CANNOT_CHANGE_OWNER_MESSAGE,
  TEAM_CANNOT_REMOVE_OWNER_MESSAGE,
  TEAM_GENERIC_ERROR_MESSAGE,
  TEAM_INVITE_UNAUTHORIZED_MESSAGE,
  TEAM_LAST_OWNER_MESSAGE,
  TEAM_MEMBER_NOT_FOUND_MESSAGE,
  TEAM_REMOVE_UNAUTHORIZED_MESSAGE,
  TEAM_ROLE_UNAUTHORIZED_MESSAGE,
  TEAM_USER_NOT_FOUND_MESSAGE,
  TEAM_VALIDATION_MESSAGE,
} from "./messages";
import { changeRoleSchema, inviteMemberSchema, membershipIdSchema } from "./schemas";
import {
  changeMemberRole,
  inviteMember,
  removeMember,
  type TeamMutationResult,
} from "./service";

export type TeamFormState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
} | null;

function fieldErrorsFromZod(
  error: ZodError
): Record<string, string[] | undefined> {
  return error.flatten().fieldErrors as Record<string, string[] | undefined>;
}

function readInviteFields(formData: FormData) {
  return {
    email: formData.get("email"),
    role: formData.get("role"),
  };
}

type FailedMutation = Extract<TeamMutationResult<unknown>, { ok: false }>;

function mapInviteError(result: FailedMutation): string {
  switch (result.code) {
    case "unauthorized":
      return TEAM_INVITE_UNAUTHORIZED_MESSAGE;
    case "cannot_assign_owner":
      return TEAM_CANNOT_ASSIGN_OWNER_ROLE_MESSAGE;
    case "user_not_found":
      return TEAM_USER_NOT_FOUND_MESSAGE;
    case "already_member":
      return TEAM_ALREADY_MEMBER_MESSAGE;
    case "invalid_input":
      return TEAM_VALIDATION_MESSAGE;
    default:
      return TEAM_GENERIC_ERROR_MESSAGE;
  }
}

function mapRoleChangeError(result: FailedMutation): string {
  switch (result.code) {
    case "unauthorized":
      return TEAM_ROLE_UNAUTHORIZED_MESSAGE;
    case "cannot_change_owner":
      return TEAM_CANNOT_CHANGE_OWNER_MESSAGE;
    case "cannot_assign_owner":
      return TEAM_CANNOT_ASSIGN_OWNER_ROLE_MESSAGE;
    case "own_membership":
      return TEAM_CANNOT_CHANGE_OWN_ROLE_MESSAGE;
    case "last_owner":
      return TEAM_LAST_OWNER_MESSAGE;
    case "not_found":
      return TEAM_MEMBER_NOT_FOUND_MESSAGE;
    case "invalid_input":
      return TEAM_VALIDATION_MESSAGE;
    default:
      return TEAM_GENERIC_ERROR_MESSAGE;
  }
}

function mapRemoveError(result: FailedMutation): string {
  switch (result.code) {
    case "unauthorized":
      return TEAM_REMOVE_UNAUTHORIZED_MESSAGE;
    case "cannot_remove_owner":
      return TEAM_CANNOT_REMOVE_OWNER_MESSAGE;
    case "not_found":
      return TEAM_MEMBER_NOT_FOUND_MESSAGE;
    case "invalid_input":
      return TEAM_VALIDATION_MESSAGE;
    default:
      return TEAM_GENERIC_ERROR_MESSAGE;
  }
}

/**
 * Invite a member (AC-TEAM-002/003).
 *
 * The workspace id and actor role come exclusively from the server-resolved
 * session workspace — any client-supplied workspace identity is ignored.
 * A MEMBER inviter is rejected before any data access.
 */
export async function inviteMemberAction(
  _prevState: TeamFormState,
  formData: FormData
): Promise<TeamFormState> {
  const parsed = inviteMemberSchema.safeParse(readInviteFields(formData));
  if (!parsed.success) {
    return {
      error: TEAM_VALIDATION_MESSAGE,
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const { workspace } = await requireSessionWorkspace();
  const result = await inviteMember(workspace.workspaceId, workspace.role, parsed.data);
  if (!result.ok) {
    return { error: mapInviteError(result) };
  }

  redirect("/team");
}

/**
 * Assign a role (AC-TEAM-004/005).
 *
 * The actor's identity, workspace, and role are resolved server-side and
 * passed to the service, which enforces the finalized role rules. The
 * client-supplied role is only a *request* — it is validated against the
 * enum and the actor's authority server-side.
 */
export async function changeMemberRoleAction(
  _prevState: TeamFormState,
  formData: FormData
): Promise<TeamFormState> {
  const parsed = changeRoleSchema.safeParse({
    membershipId: formData.get("membershipId"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return {
      error: TEAM_VALIDATION_MESSAGE,
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const { user, workspace } = await requireSessionWorkspace();
  const result = await changeMemberRole(
    workspace.workspaceId,
    user.id,
    workspace.role,
    parsed.data.membershipId,
    parsed.data.role
  );
  if (!result.ok) {
    return { error: mapRoleChangeError(result) };
  }

  redirect("/team");
}

/**
 * Remove a member (AC-TEAM-006/007).
 *
 * Removal is OWNER-only (BR-TEAM-008) and OWNER targets are always rejected
 * (BR-TEAM-009). The target membership is scoped by the server-resolved
 * workspace, so a membership from another workspace is reported as not
 * found — no disclosure.
 */
export async function removeMemberAction(
  _prevState: TeamFormState,
  formData: FormData
): Promise<TeamFormState> {
  const membershipId = membershipIdSchema.safeParse(formData.get("membershipId"));
  if (!membershipId.success) {
    return { error: TEAM_MEMBER_NOT_FOUND_MESSAGE };
  }

  const { workspace } = await requireSessionWorkspace();
  const result = await removeMember(workspace.workspaceId, workspace.role, membershipId.data);
  if (!result.ok) {
    return { error: mapRemoveError(result) };
  }

  redirect("/team");
}