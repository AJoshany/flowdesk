"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction } from "@/features/auth/actions";
import { PASSWORD_MIN_LENGTH } from "@/features/auth/schemas";

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

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, null);

  return (
    <div className="rounded-lg border border-border bg-white p-6">
      <h1 className="text-h5 text-heading">Create your account</h1>
      <p className="mt-1 text-body-regular-14 text-body-light">
        Your workspace will be created when you sign up.
      </p>

      <form action={formAction} className="mt-6 space-y-4">
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
            autoComplete="email"
            required
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-body-regular-14 text-heading outline-none placeholder:text-body-light focus:border-primary-light"
            placeholder="you@example.com"
          />
          <FieldErrors errors={state?.fieldErrors?.email} />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-body-medium-14 text-heading"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-body-regular-14 text-heading outline-none placeholder:text-body-light focus:border-primary-light"
            placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
          />
          <FieldErrors errors={state?.fieldErrors?.password} />
        </div>

        {state?.error ? (
          <p role="alert" className="text-body-regular-14 text-red">
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-primary-accent px-4 py-2 text-body-medium-14 text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Creating your account…" : "Create account"}
        </button>
      </form>

      <p className="mt-4 text-center text-body-regular-14 text-body-light">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-link-regular-14 text-primary-accent"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
