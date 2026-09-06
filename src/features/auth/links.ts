import { AUTH_SETTINGS_LINK } from "./messages";

/**
 * Auth error UX helpers for the register/login forms.
 *
 * These are intentionally runtime-only — they read env at request time and
 * return an actionable in-form message when the app misconfiguration causes
 * signIn() to fail at runtime (the kind of failure that would otherwise
 * surface as a raw 500 + React error #441 to the user).
 */
export function setupAuthErrorLink(input: {
  actionName: "login" | "register";
  destination: string;
}): string | null {
  const secret = process.env.AUTH_SECRET;
  const url = process.env.NEXTAUTH_URL;

  if (!secret || !secret.trim()) {
    return `Sign-in isn't configured yet. Set AUTH_SECRET and NEXTAUTH_URL in Settings, then try the ${input.actionName} again. You can also go to ${AUTH_SETTINGS_LINK} for account settings.`;
  }

  if (!url || !url.trim()) {
    return `Sign-in isn't configured yet. Set NEXTAUTH_URL in Settings, then try the ${input.actionName} again. You can also go to ${AUTH_SETTINGS_LINK} for account settings.`;
  }

  return null;
}
