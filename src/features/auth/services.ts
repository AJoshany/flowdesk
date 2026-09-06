import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "./password";
import { registerSchema } from "./schemas";

/** Approved MVP decision: the initial workspace is named "My Workspace". */
export const DEFAULT_WORKSPACE_NAME = "My Workspace";

export type RegistrationResult =
  | { ok: true; user: { id: string; email: string } }
  | { ok: false; code: "duplicate" | "invalid_input" };

/**
 * Registration service.
 *
 * Creates User + Workspace + OWNER Membership in sequence (not transactionally
 * — Neon's PgBouncer pooler does not support interactive transactions). If any
 * step after User creation fails, the orphan records are cleaned up so a user
 * can never exist without a valid membership.
 *
 * It deliberately contains NO credential-verification logic — it hashes
 * a *new* password but never verifies a presented one. Verifying a presented
 * password happens in exactly one place: the Auth.js Credentials provider
 * `authorize()` (src/auth.ts).
 */
export async function registerUser(input: {
  email: string;
  password: string;
}): Promise<RegistrationResult> {
  // Validate at the server boundary (REQ-GEN-002).
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "invalid_input" };
  }
  const { email, password } = parsed.data;

  // Fast-path duplicate check for a safe error (BR-AUTH-001 / AC-AUTH-002).
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, code: "duplicate" };
  }

  const passwordHash = await hashPassword(password);

  // Sequential writes instead of an interactive transaction: Neon's
  // transaction-mode pooler (PgBouncer) does not support interactive
  // transactions, so $transaction fails on writes while reads succeed.
  // Cleanup on partial failure prevents orphan User records (HIGH-001).
  let createdUser: { id: string; email: string } | null = null;
  let createdWorkspaceId: string | null = null;
  try {
    createdUser = await prisma.user.create({
      data: { email, passwordHash },
      select: { id: true, email: true },
    });
    const workspace = await prisma.workspace.create({
      data: { name: DEFAULT_WORKSPACE_NAME },
      select: { id: true },
    });
    createdWorkspaceId = workspace.id;
    // First membership of the new workspace is OWNER (BR-AUTH-002).
    await prisma.membership.create({
      data: {
        userId: createdUser.id,
        workspaceId: workspace.id,
        role: "OWNER",
      },
      select: { id: true },
    });
    return { ok: true, user: createdUser };
  } catch (error) {
    // Concurrent duplicate registration: the unique email constraint rejects
    // the second insert (P2002). Map it to the same safe duplicate error.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, code: "duplicate" };
    }

    // Partial failure cleanup: if the User was created but workspace or
    // membership creation failed, delete the orphan User so it cannot
    // exist without a membership (which would leave the user stuck in a
    // logged-in-but-inaccessible state).
    if (createdUser) {
      await prisma.user
        .delete({ where: { id: createdUser.id } })
        .catch(() => undefined);
    }
    if (createdWorkspaceId) {
      await prisma.workspace
        .delete({ where: { id: createdWorkspaceId } })
        .catch(() => undefined);
    }
    throw error;
  }
}
