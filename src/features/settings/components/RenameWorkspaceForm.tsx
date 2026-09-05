"use client";

import { useActionState } from "react";
import { renameWorkspaceAction } from "@/features/settings/actions";

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

export function RenameWorkspaceForm({ currentName }: { currentName: string }) {
  const [state, formAction, pending] = useActionState(
    renameWorkspaceAction,
    null
  );

  return (
    <form action={formAction} className="mt-4">
      <label
        htmlFor="name"
        className="mb-1 block text-body-medium-14 text-heading"
      >
        Workspace name
      </label>
      <div className="flex flex-wrap items-start gap-2">
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={80}
          defaultValue={currentName}
          className={`${inputClasses} max-w-xs`}
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary-accent px-4 py-2 text-body-medium-14 text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <FieldErrors errors={state?.fieldErrors?.name} />
      {state?.error ? (
        <p role="alert" className="mt-1 text-body-regular-14 text-red">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}