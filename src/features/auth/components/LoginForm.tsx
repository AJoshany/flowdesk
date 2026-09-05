"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction } from "@/features/auth/actions";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, null);

  return (
    <div className="rounded-lg border border-border bg-white p-6">
      <h1 className="text-h5 text-heading">Sign in</h1>
      <p className="mt-1 text-body-regular-14 text-body-light">
        Welcome back. Enter your credentials to access your workspace.
      </p>

      <form action={formAction} className="mt-6 space-y-4">
        {callbackUrl ? (
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
        ) : null}

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
            autoComplete="current-password"
            required
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-body-regular-14 text-heading outline-none placeholder:text-body-light focus:border-primary-light"
            placeholder="••••••••"
          />
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
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-4 text-center text-body-regular-14 text-body-light">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="text-link-regular-14 text-primary-accent"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
