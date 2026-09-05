"use client";

import { useActionState } from "react";
import { removeMemberAction } from "@/features/team/actions";

export function RemoveMemberForm({ membershipId }: { membershipId: string }) {
  const [state, formAction, pending] = useActionState(removeMemberAction, null);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="membershipId" value={membershipId} />
      {state?.error ? (
        <p role="alert" className="text-body-regular-12 text-red">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-red bg-white px-3 py-1.5 text-body-medium-14 text-red transition-colors hover:bg-red/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
    </form>
  );
}