import { describe, expect, it, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { registerUser } from "@/features/auth/services";
import { uniqueEmail } from "../../../tests/helpers/env";
import { requireWorkspaceAccess } from "./access";

const PASSWORD = "password-123";

class NotFoundSignal extends Error {
  constructor() {
    super("notFound()");
    this.name = "NotFoundSignal";
  }
}

const notFoundMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

async function registerOwner(prefix: string): Promise<{
  userId: string;
  workspaceId: string;
}> {
  const email = uniqueEmail(prefix);
  const result = await registerUser({ email, password: PASSWORD });
  if (!result.ok) throw new Error(`seed failed for ${prefix}`);
  const membership = await prisma.membership.findFirstOrThrow({
    where: { userId: result.user.id },
    select: { workspaceId: true },
  });
  return { userId: result.user.id, workspaceId: membership.workspaceId };
}

describe("requireWorkspaceAccess (authorization boundary, integration)", () => {
  beforeEach(() => {
    vi.mocked(notFoundMock).mockReset();
    vi.mocked(notFoundMock).mockImplementation(() => {
      throw new NotFoundSignal();
    });
  });

  it("grants an OWNER member access to their own workspace (AC-WS-001)", async () => {
    const { userId, workspaceId } = await registerOwner("acc-owner");

    await expect(requireWorkspaceAccess(userId, workspaceId)).resolves.toEqual({
      workspaceId,
      role: "OWNER",
    });
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("denies an authenticated user who has no membership in the target workspace (AC-WS-002)", async () => {
    const a = await registerOwner("acc-a");
    const b = await registerOwner("acc-b");

    // B is authenticated and a member of their own workspace, but not of A's.
    await expect(
      requireWorkspaceAccess(b.userId, a.workspaceId)
    ).rejects.toThrow(NotFoundSignal);
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("rejects cross-workspace access: a member of B cannot reach workspace A data (AC-WS-003)", async () => {
    const a = await registerOwner("acc-x-a");
    const b = await registerOwner("acc-x-b");

    // Workspace A's OWNER can access A…
    await expect(
      requireWorkspaceAccess(a.userId, a.workspaceId)
    ).resolves.toMatchObject({ workspaceId: a.workspaceId });

    // …but a member of workspace B requesting workspace A is rejected, even
    // though both users are valid, authenticated workspace members.
    await expect(
      requireWorkspaceAccess(b.userId, a.workspaceId)
    ).rejects.toThrow(NotFoundSignal);
  });

  it("denies access to a nonexistent workspace without revealing it (error cases §6)", async () => {
    const { userId } = await registerOwner("acc-missing");

    await expect(
      requireWorkspaceAccess(userId, "000000000000000000000000")
    ).rejects.toThrow(NotFoundSignal);
  });

  it("denies malformed/empty workspace ids", async () => {
    const { userId } = await registerOwner("acc-empty");

    await expect(requireWorkspaceAccess(userId, "")).rejects.toThrow(
      NotFoundSignal
    );
  });

  it("returns the role from the database row — role is never a client input", async () => {
    const owner = await registerOwner("acc-role-owner");
    const other = await registerOwner("acc-role-member");

    // `other` joins the owner's workspace as a plain MEMBER.
    await prisma.membership.create({
      data: {
        userId: other.userId,
        workspaceId: owner.workspaceId,
        role: "MEMBER",
      },
    });

    // The boundary has no role parameter: the caller cannot assert, request or
    // change a role. The returned role is whatever the membership row stores.
    const access = await requireWorkspaceAccess(other.userId, owner.workspaceId);
    expect(access).toEqual({ workspaceId: owner.workspaceId, role: "MEMBER" });

    const ownAccess = await requireWorkspaceAccess(other.userId, other.workspaceId);
    expect(ownAccess).toEqual({ workspaceId: other.workspaceId, role: "OWNER" });
  });

  it("cannot be used to impersonate another user's membership", async () => {
    const a = await registerOwner("acc-imp-a");
    const b = await registerOwner("acc-imp-b");

    // The boundary only resolves memberships for the exact (userId, workspaceId)
    // pair supplied by the server layer. A request for B's workspace keyed on
    // A's identity is denied — A holds no membership there.
    await expect(
      requireWorkspaceAccess(a.userId, b.workspaceId)
    ).rejects.toThrow(NotFoundSignal);

    // And B's OWNER membership is only resolvable with B's own (session)
    // identity — nothing about A grants access to it.
    await expect(requireWorkspaceAccess(b.userId, b.workspaceId)).resolves.toEqual({
      workspaceId: b.workspaceId,
      role: "OWNER",
    });
  });
});
