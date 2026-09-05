import { describe, expect, it, beforeEach, vi } from "vitest";

class RedirectSignal extends Error {
  constructor(readonly url: string) {
    super(`redirect(${url})`);
    this.name = "RedirectSignal";
  }
}

class NotFoundSignal extends Error {
  constructor() {
    super("notFound()");
    this.name = "NotFoundSignal";
  }
}

// -- mocks ---------------------------------------------------------------

const getCurrentUserMock = vi.hoisted(() => vi.fn());
const getWorkspaceContextMock = vi.hoisted(() => vi.fn());
const requireUserMock = vi.hoisted(() => vi.fn());
const notFoundMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth/session", () => ({
  getCurrentUser: getCurrentUserMock,
  getWorkspaceContext: getWorkspaceContextMock,
  requireUser: requireUserMock,
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
}));

// -- fixtures ------------------------------------------------------------

const USER = { id: "user-1", email: "owner@example.com" };
const WORKSPACE = {
  workspaceId: "ws-1",
  workspaceName: "My Workspace",
  role: "OWNER",
} as const;

// -- tests ---------------------------------------------------------------

describe("getSessionWorkspace", () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset();
    getWorkspaceContextMock.mockReset();
  });

  it("returns null when the visitor is unauthenticated", async () => {
    getCurrentUserMock.mockResolvedValue(null);
    const { getSessionWorkspace } = await import("./session-workspace");
    await expect(getSessionWorkspace()).resolves.toBeNull();
    expect(getWorkspaceContextMock).not.toHaveBeenCalled();
  });

  it("returns null when the authenticated user has no workspace membership", async () => {
    getCurrentUserMock.mockResolvedValue(USER);
    getWorkspaceContextMock.mockResolvedValue(null);
    const { getSessionWorkspace } = await import("./session-workspace");
    await expect(getSessionWorkspace()).resolves.toBeNull();
  });

  it("composes the session user with their workspace context", async () => {
    getCurrentUserMock.mockResolvedValue(USER);
    getWorkspaceContextMock.mockResolvedValue(WORKSPACE);
    const { getSessionWorkspace } = await import("./session-workspace");
    await expect(getSessionWorkspace()).resolves.toEqual({
      user: USER,
      workspace: WORKSPACE,
    });
  });
});

describe("requireSessionWorkspace", () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset();
    getWorkspaceContextMock.mockReset();
    requireUserMock.mockReset();
    notFoundMock.mockReset();
    notFoundMock.mockImplementation(() => {
      throw new NotFoundSignal();
    });
  });

  it("redirects unauthenticated users to /login (auth requireUser handles it)", async () => {
    requireUserMock.mockImplementation(() => {
      throw new RedirectSignal("/login");
    });
    const { requireSessionWorkspace } = await import("./session-workspace");
    await expect(requireSessionWorkspace()).rejects.toThrow(RedirectSignal);
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("denies an authenticated user without a workspace membership (AC-WS-002)", async () => {
    requireUserMock.mockResolvedValue(USER);
    getWorkspaceContextMock.mockResolvedValue(null);
    const { requireSessionWorkspace } = await import("./session-workspace");
    await expect(requireSessionWorkspace()).rejects.toThrow(NotFoundSignal);
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("returns the composed session + workspace for an authenticated member (AC-WS-001)", async () => {
    requireUserMock.mockResolvedValue(USER);
    getWorkspaceContextMock.mockResolvedValue(WORKSPACE);
    const { requireSessionWorkspace } = await import("./session-workspace");
    await expect(requireSessionWorkspace()).resolves.toEqual({
      user: USER,
      workspace: WORKSPACE,
    });
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});
