"use client";

import { useActionState } from "react";
import { inviteMemberAction } from "@/features/team/actions";
import { TEAM_ROLE_LABELS, type TeamRole } from "@/features/team/roles";

type InviteMemberFormProps = {
  /** Roles the inviter may grant (OWNER: all three; MANAGER: MANAGER/MEMBER).
   * The server enforces the same boundary independently of this UI. */
  assignableRoles: TeamRole[];
};

function FieldErrors({ errors }: { errors?: string[] }) {
  if (!errors || errors.length === 0) {
    return null;
  }
  return (
    <ul role="alert" className="mt-1 space-y-1">
      {errors.map((message) => (
        <li key={message} className="text-body-regular-12 text-red">
          {message}
        </li>
      ))}
    </ul>
  );
}

const inputClasses =
  "w-full rounded-lg border border-border bg-white px-3 py-2 text-body-regular-14 text-heading outline-none placeholder:text-body-light focus:border-primary-light";

export function InviteMemberForm({ assignableRoles }: InviteMemberFormProps) {
  const [state, formAction, pending] = useActionState(inviteMemberAction, null);

  return (
    <form
      action={formAction}
      className="mt-6 space-y-4 rounded-lg border border-border bg-white p-6"
    >
      <div>
        <label
          htmlFor="email"
          className="mb-1 block text-body-medium-14 text-heading"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className={inputClasses}
          placeholder="member@example.com"
        />
        <FieldErrors errors={state?.fieldErrors?.email} />
      </div>

      <div>
        <label
          htmlFor="role"
          className="mb-1 block text-body-medium-14 text-heading"
        >
          Role
        </label>
        <select id="role" name="role" defaultValue="MEMBER" className={inputClasses}>
          {assignableRoles.map((role) => (
            <option key={role} value={role}>
              {TEAM_ROLE_LABELS[role]}
            </option>
          ))}
        </select>
        <FieldErrors errors={state?.fieldErrors?.role} />
      </div>

      {state?.error ? (
        <p role="alert" className="text-body-regular-14 text-red">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-primary-accent px-4 py-2 text-body-medium-14 text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Inviting…" : "Invite member"}
      </button>
    </form>
  );
}