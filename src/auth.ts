import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { authorizeCredentials } from "@/features/auth/credentials";

/**
 * Auth.js configuration.
 *
 * The Credentials provider `authorize()` (implemented in
 * src/features/auth/credentials.ts) is the SINGLE SOURCE OF TRUTH for
 * credential verification: it is the only code path in the application that
 * verifies a presented password (user lookup + hash comparison). Login and
 * registration server actions delegate to Auth.js `signIn()`, which runs this
 * provider. No other module compares password hashes.
 *
 * Node-only pieces (Prisma) live here, NOT in src/auth.config.ts, which is
 * imported by the edge-runtime middleware.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: authorizeCredentials,
    }),
  ],
});
