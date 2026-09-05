import { prisma } from "@/lib/prisma";
import { verifyPassword } from "./password";
import { loginSchema } from "./schemas";

export type VerifiedUser = { id: string; email: string };

/**
 * The Credentials provider `authorize()` implementation.
 *
 * SINGLE SOURCE OF TRUTH for credential verification: this function (invoked
 * exclusively by the Auth.js Credentials provider in src/auth.ts) is the only
 * code path that verifies a presented password. Unknown email and wrong
 * password both return `null` → identical outcomes, so account existence is
 * never disclosed. The returned object is minimal (`{ id, email }`) — never
 * the password hash or role/workspace data.
 */
export async function authorizeCredentials(
  credentials: Partial<Record<"email" | "password", unknown>> | undefined
): Promise<VerifiedUser | null> {
  const parsed = loginSchema.safeParse(credentials ?? {});
  if (!parsed.success) {
    return null;
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true },
  });
  if (!user) {
    return null;
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);
  if (!passwordMatches) {
    return null;
  }

  return { id: user.id, email: user.email };
}
