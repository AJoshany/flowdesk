import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js base configuration.
 *
 * Next.js runs `middleware.ts` (proxy) in the edge runtime, which cannot load
 * Node-only modules (Prisma/pg, Jest, vitest, or the test helpers). This config
 * deliberately has NO providers and NO database imports — the Credentials
 * provider (which needs Prisma) is attached in `src/auth.ts` only. Middleware
 * imports this config to decode the JWT session cookie.
 *
 * The session carries only the minimal identity payload (user id + email); the
 * role and workspace context are NEVER stored in the token — they are resolved
 * server-side from the session principal + Prisma on demand.
 */
export const authConfig: NextAuthConfig = {
  providers: [],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },

  /**
   * Host / origin the app is served at.
   *
   * The production host is set via `NEXTAUTH_URL` (which `next-auth` reads
   * directly). After provisioning production, add the env var:
   *
   *   NEXTAUTH_URL = https://flowdesk.freebuff.app
   *
   * `trustHost: true` tells Auth.js to trust the host even before the secret
   * is fully configured at dev time (the demo/dev server never has a
   * NEXTAUTH_URL, so this avoids startup failures locally).
   */
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  callbacks: {
    jwt({ token, user }) {
      // On sign-in `user` is the value returned by authorize().
      if (user) {
        token.sub = user.id;
        token.email = user.email;
      }
      return token;
    },
    session({ session, token }) {
      // Expose only id + email in the session (minimal session payload).
      if (session.user) {
        if (typeof token.sub === "string") {
          session.user.id = token.sub;
        }
        if (typeof token.email === "string") {
          session.user.email = token.email;
        }
      }
      return session;
    },
  },
};
