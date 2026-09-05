"use client";

import { useActionState } from "react";
import { changeMemberRoleAction } from "@/features/team/actions";
import { TEAM_ROLE_LABELS, type TeamRole } from "@/features/team/roles";

type MemberRoleFormProps = {
  membershipId: string;
  currentRole: TeamRole;
  /** Roles the actor may assign (OWNER: all three; MANAGER: MANAGER/MEMBER).
   * The server enforces the same boundary independently of this UI. */
  assignableRoles: TeamRole[];
};

const selectClasses =
  "rounded-lg border border-border bg-white px-2 py-1.5 text-body-regular-14 text-heading outline-none focus:border-primary-light";

export function MemberRoleForm({
  membershipId,
  currentRole,
  assignableRoles,
}: MemberRoleFormProps) {
  const [state, formAction, pending] = useActionState(changeMemberRoleAction, null);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="membershipId" value={membershipId} />
      <select name="role" defaultValue={currentRole} className={selectClasses}>
        {assignableRoles.map((role) => (
          <option key={role} value={role}>
            {TEAM_ROLE_LABELS[role]}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-border bg-white px-3 py-1.5 text-body-medium-14 text-heading transition-colors hover:bg-bg disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {state?.error ? (
        <p role="alert" className="text-body-regular-12 text-red">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}