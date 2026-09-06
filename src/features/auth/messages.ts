/**
 * User-facing authentication messages.
 *
 * These live outside the server-action module because `"use server"` files
 * can only export async functions, and the messages are also needed by the
 * client form components and the tests.
 */

/** Generic invalid-credentials error. Deliberately identical for an unknown
 * email and a wrong password so account existence is never disclosed. */
export const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password.";

export const DUPLICATE_ACCOUNT_MESSAGE =
  "An account with this email already exists. Please sign in instead.";

export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export const REGISTRATION_ERROR_MESSAGE = "We could not create your account. Please try again.";

/** Link shown next to auth configuration failure messages. */
export const AUTH_SETTINGS_LINK = "/settings";

