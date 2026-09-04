/**
 * Post-authentication redirect resolution.
 *
 * `callbackUrl` originates from the query string and is embedded in a hidden
 * form field, so it is user-controlled input. It must be validated server-side
 * to prevent open-redirect abuse: only same-site absolute paths are accepted.
 */
export const DEFAULT_AUTH_REDIRECT = "/dashboard";

/** Paths that must never be used as post-auth redirect targets. */
const NON_TARGET_PATHS = ["/login", "/register"];

export function isInternalPath(path: unknown): path is string {
  return (
    typeof path === "string" &&
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.includes("\\") &&
    !path.includes("://")
  );
}

/** Returns the validated callbackUrl, or the default dashboard route. */
export function resolveRedirectTarget(
  callbackUrl: FormDataEntryValue | string | null | undefined
): string {
  if (typeof callbackUrl === "string" && isInternalPath(callbackUrl)) {
    const pathname = callbackUrl.split("?")[0];
    if (!NON_TARGET_PATHS.includes(pathname)) {
      return callbackUrl;
    }
  }
  return DEFAULT_AUTH_REDIRECT;
}
