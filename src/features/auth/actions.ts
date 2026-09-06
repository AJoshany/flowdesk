"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import type { ZodError } from "zod";
import { signIn, signOut } from "@/auth";
import {
  GENERIC_ERROR_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  REGISTRATION_ERROR_MESSAGE,
  DUPLICATE_ACCOUNT_MESSAGE,
} from "./messages";
import { resolveRedirectTarget } from "./redirects";
import { setupAuthErrorLink } from "@/features/auth/links";
import { loginSchema, registerSchema } from "./schemas";
import { registerUser } from "./services";

export type AuthFormState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
} | null;

function readEmailAndPassword(formData: FormData): {
  email: unknown;
  password: unknown;
} {
  return {
    email: formData.get("email"),
    password: formData.get("password"),
  };
}

function fieldErrorsFromZod(
  error: ZodError
): Record<string, string[] | undefined> {
  return error.flatten().fieldErrors as Record<string, string[] | undefined>;
}

/**
 * Login.
 *
 * The action ONLY orchestrates the flow: validate format at the server
 * boundary, delegate to Auth.js `signIn("credentials")`, and map the outcome.
 * The Credentials provider `authorize()` (src/auth.ts) is the single source of
 * truth for credential verification — this action never looks up the user or
 * compares password hashes itself.
 */
export async function loginAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse(readEmailAndPassword(formData));
  if (!parsed.success) {
    return {
      error: INVALID_CREDENTIALS_MESSAGE,
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const { email, password } = parsed.data;
  const callbackUrl = formData.get("callbackUrl");

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    // `authorize()` returns null for both unknown email and wrong password,
    // which makes Auth.js throw a CredentialsSignin error. All AuthErrors map
    // to the same generic message so account existence is never disclosed.
    if (error instanceof AuthError) {
      return { error: INVALID_CREDENTIALS_MESSAGE };
    }
    // Non-AuthError failures (e.g. a missing/invalid server configuration such
    // as a missing AUTH_SECRET) are surfaced in the form rather than a raw 500
    // + React error #441, without leaking any configuration detail.
    const nonAuthError = setupAuthErrorLink({
      actionName: "login",
      destination: resolveRedirectTarget(callbackUrl),
    });
    if (nonAuthError) {
      return { error: nonAuthError };
    }
    return { error: INVALID_CREDENTIALS_MESSAGE };
  }

  redirect(resolveRedirectTarget(callbackUrl));
}

/**
 * Registration.
 *
 * Registration uses the dedicated `registerUser` service because it must
 * transactionally create User + Workspace + OWNER Membership. After the
 * account exists, the new user is authenticated through the SAME Auth.js
 * `signIn("credentials")` path used by login — never a second verification
 * path.
 */
export async function registerAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse(readEmailAndPassword(formData));
  if (!parsed.success) {
    return {
      error: "Please fix the errors below and try again.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const { email, password } = parsed.data;
  const result = await registerUser({ email, password });
  if (!result.ok) {
    if (result.code === "duplicate") {
      return { error: DUPLICATE_ACCOUNT_MESSAGE };
    }
    return { error: REGISTRATION_ERROR_MESSAGE };
  }

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    // `signIn` throws for any auth-failure path that is NOT an AuthError
    // (e.g. a missing/invalid server configuration such as a missing AUTH_SECRET).
    // AuthError is already mapped above for the login action.
    if (error instanceof AuthError) {
      return { error: GENERIC_ERROR_MESSAGE };
    }
    // Non-AuthError config/runtime failures: surface a single, non-leaking
    // message in the form rather than a raw 500 + React error #441.
    const nonAuthError = setupAuthErrorLink({
      actionName: "register",
      destination: "/dashboard",
    });
    if (nonAuthError) {
      return { error: nonAuthError };
    }
    return { error: REGISTRATION_ERROR_MESSAGE };
  }

  // Approved MVP decision: registration always lands on /dashboard.
  redirect("/dashboard");
}

/**
 * Logout.
 *
 * Terminates the session (destroys the session cookie) and sends the user to
 * the login flow. With the JWT strategy, "session terminated" means the
 * session cookie is destroyed and the JWT can no longer be presented.
 */
export async function logoutAction(): Promise<void> {
  await signOut({ redirect: false });
  redirect("/login");
}
