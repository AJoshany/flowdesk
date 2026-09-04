import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

/** Hash a new password. Used only by the registration service. */
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a presented password against a stored hash.
 *
 * IMPORTANT: this comparison is the credential-verification step and must
 * only be invoked from the Auth.js Credentials provider `authorize()`
 * (src/auth.ts) — the single source of truth for credential verification.
 * Registration hashes a *new* password but never verifies a presented one.
 */
export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
