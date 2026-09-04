import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js base configuration.
 *
 * Next.js runs `middleware.ts` (proxy) in the edge runtime, which cannot load
 * Node-only modules (Prisma/pg). This config deliberately has NO providers and
 * no database imports — the Credentials provider (which needs Prisma) is
 * attached in `src/auth.ts` only. Middleware imports this config to decode the
 * JWT session cookie.
 *
 * The session carries only the minimal identity payload (user id + email);
 * membership and role are never stored in the token.
 */
export const authConfig = {
  providers: [],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
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
} satisfies NextAuthConfig;
