"use client";

import { useActionState } from "react";
import { deleteDealAction } from "@/features/deals/actions";

export function DeleteDealForm({ dealId }: { dealId: string }) {
  const [state, formAction, pending] = useActionState(deleteDealAction, null);

  return (
    <form
      action={formAction}
      className="mt-6 rounded-lg border border-border bg-white p-6"
    >
      <input type="hidden" name="dealId" value={dealId} />
      <h2 className="text-h6 text-heading">Delete deal</h2>
      <p className="mt-1 text-body-regular-14 text-body-light">
        This permanently removes the deal from your workspace.
      </p>

      {state?.error ? (
        <p role="alert" className="mt-3 text-body-regular-14 text-red">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-lg border border-red bg-white px-4 py-2 text-body-medium-14 text-red disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete deal"}
      </button>
    </form>
  );
}
