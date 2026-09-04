/**
 * Minimal stand-in for the parts of `next-auth` that unit tests touch.
 *
 * Importing the real `next-auth` package inside Vitest pulls in Next.js
 * server internals (e.g. `next/server`) that cannot be resolved outside a
 * Next runtime. The server actions only use `AuthError` for error mapping
 * (`instanceof`), so this shim preserves the tested behavior. The real
 * Auth.js framework (including its real error types) is exercised end-to-end
 * by the HTTP tests in `tests/auth.http.e2e.test.ts`.
 */
export class AuthError extends Error {
  readonly type: string;

  constructor(message?: string, type = "CredentialsSignin") {
    super(message ?? "Auth error");
    this.name = "AuthError";
    this.type = type;
  }
}
