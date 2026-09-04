import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

/**
 * Middleware (edge runtime) enforcing protected routes.
 *
 * Uses the edge-safe base config (src/auth.config.ts) — the full config in
 * src/auth.ts imports Prisma and cannot run in the edge runtime.
 */

/** Protected application areas (docs/architecture/authentication.md §7). */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/customers",
  "/deals",
  "/activities",
  "/team",
  "/settings",
];

/** Public auth pages — authenticated users are sent to the dashboard. */
const AUTH_PAGES = ["/login", "/register"];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export default NextAuth(authConfig).auth((req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;
  const isAuthenticated = Boolean(req.auth);

  // REQ-AUTH-004 / AC-AUTH-005: unauthenticated users are redirected to the
  // login flow, preserving the originally requested destination.
  if (!isAuthenticated && isProtectedPath(pathname)) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Approved MVP decision: authenticated users visiting /login or /register
  // are redirected to the dashboard.
  if (isAuthenticated && AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/customers/:path*",
    "/deals/:path*",
    "/activities/:path*",
    "/team/:path*",
    "/settings/:path*",
    "/login",
    "/register",
  ],
};
