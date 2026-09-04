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
 * This is the only auth "service": registration must transactionally create
 * User + Workspace + OWNER Membership, so it warrants dedicated business
 * logic. It deliberately contains NO credential-verification logic — it hashes
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

  try {
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: { email, passwordHash },
        select: { id: true, email: true },
      });
      const workspace = await tx.workspace.create({
        data: { name: DEFAULT_WORKSPACE_NAME },
        select: { id: true },
      });
      // First membership of the new workspace is OWNER (BR-AUTH-002).
      await tx.membership.create({
        data: {
          userId: createdUser.id,
          workspaceId: workspace.id,
          role: "OWNER",
        },
        select: { id: true },
      });
      return createdUser;
    });
    return { ok: true, user };
  } catch (error) {
    // Concurrent duplicate registration: the unique email constraint rejects
    // the second insert (P2002). Map it to the same safe duplicate error.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, code: "duplicate" };
    }
    throw error;
  }
}
