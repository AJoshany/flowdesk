import { describe, expect, it, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { uniqueEmail } from "../../../tests/helpers/env";
import { registerUser } from "./services";

// -- mocks ---------------------------------------------------------------

class RedirectSignal extends Error {
  constructor(readonly url: string) {
    super(`redirect(${url})`);
    this.name = "RedirectSignal";
  }
}

const authMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({
  auth: authMock,
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));

// -- helpers -------------------------------------------------------------

const PASSWORD = "password-123";

async function registerUniqueUser(prefix: string) {
  const email = uniqueEmail(prefix);
  const result = await registerUser({ email, password: PASSWORD });
  if (!result.ok) throw new Error("failed to seed user");
  return { email, user: result.user };
}

// -- tests ---------------------------------------------------------------

describe("getCurrentUser", () => {
  beforeEach(() => {
    vi.mocked(authMock).mockReset();
  });

  it("returns null when there is no session", async () => {
    vi.mocked(authMock).mockResolvedValue(null);
    const { getCurrentUser } = await import("./session");
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("returns { id, email } from the session", async () => {
    vi.mocked(authMock).mockResolvedValue({
      user: { id: "user-1", email: "someone@example.com" },
    });
    const { getCurrentUser } = await import("./session");
    await expect(getCurrentUser()).resolves.toEqual({
      id: "user-1",
      email: "someone@example.com",
    });
  });
});

describe("requireUser", () => {
  beforeEach(() => {
    vi.mocked(authMock).mockReset();
    vi.mocked(redirectMock).mockReset();
    vi.mocked(redirectMock).mockImplementation((url: string) => {
      throw new RedirectSignal(url);
    });
  });

  it("redirects to /login when unauthenticated", async () => {
    vi.mocked(authMock).mockResolvedValue(null);
    const { requireUser } = await import("./session");
    await expect(requireUser()).rejects.toThrow(RedirectSignal);
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("returns the user when authenticated", async () => {
    vi.mocked(authMock).mockResolvedValue({
      user: { id: "user-2", email: "owner@example.com" },
    });
    const { requireUser } = await import("./session");
    await expect(requireUser()).resolves.toEqual({
      id: "user-2",
      email: "owner@example.com",
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("workspace membership boundary (integration, test database)", () => {
  beforeEach(() => {
    vi.mocked(redirectMock).mockReset();
    vi.mocked(redirectMock).mockImplementation((url: string) => {
      throw new RedirectSignal(url);
    });
  });

  it("resolves the OWNER membership + workspace created at registration (BR-AUTH-002)", async () => {
    const { user } = await registerUniqueUser("ctx");
    const { getWorkspaceContext } = await import("./session");

    const context = await getWorkspaceContext(user.id);
    expect(context).not.toBeNull();
    expect(context?.role).toBe("OWNER");
    expect(context?.workspaceName).toBe("My Workspace");
  });

  it("returns null for a user with no membership", async () => {
    const user = await prisma.user.create({
      data: { email: uniqueEmail("nomembership"), passwordHash: "x" },
      select: { id: true },
    });
    const { getWorkspaceContext } = await import("./session");
    await expect(getWorkspaceContext(user.id)).resolves.toBeNull();
  });

  it("rejects a membership of another user's workspace (workspace isolation, BR-AUTH-004/005)", async () => {
    const a = await registerUniqueUser("iso-a");
    const b = await registerUniqueUser("iso-b");
    const { getWorkspaceContext, requireWorkspaceMembership } = await import(
      "./session"
    );

    // Each user resolves only their own workspace.
    const contextA = await getWorkspaceContext(a.user.id);
    const contextB = await getWorkspaceContext(b.user.id);
    expect(contextA?.workspaceId).not.toBe(contextB?.workspaceId);

    // User B must not resolve membership in User A's workspace.
    if (!contextA) throw new Error("missing context A");
    await expect(
      requireWorkspaceMembership(b.user.id, contextA.workspaceId)
    ).rejects.toThrow(RedirectSignal);
    expect(redirectMock).toHaveBeenCalledWith("/login");

    // User A can resolve their own workspace through the boundary.
    await expect(
      requireWorkspaceMembership(a.user.id, contextA.workspaceId)
    ).resolves.toMatchObject({ workspaceId: contextA.workspaceId, role: "OWNER" });
  });

  it("resolves the primary workspace when no workspace id is given", async () => {
    const { user } = await registerUniqueUser("primary");
    const { requireWorkspaceMembership } = await import("./session");
    const context = await requireWorkspaceMembership(user.id);
    expect(context?.role).toBe("OWNER");
    expect(context?.workspaceId).toBeTruthy();
  });

  it("never accepts client-provided role or identity (only the session user id is used)", async () => {
    const { user } = await registerUniqueUser("notrust");
    const { getWorkspaceContext } = await import("./session");

    // The boundary API takes the authenticated user's id only; a fabricated
    // workspace id for that user cannot be resolved.
    const context = await getWorkspaceContext(user.id);
    if (!context) throw new Error("missing context");
    const fabricated = await prisma.workspace.findFirst({
      where: { id: { not: context.workspaceId } },
      select: { id: true },
    });
    if (fabricated) {
      const { requireWorkspaceMembership } = await import("./session");
      await expect(
        requireWorkspaceMembership(user.id, fabricated.id)
      ).rejects.toThrow(RedirectSignal);
    }
  });
});
