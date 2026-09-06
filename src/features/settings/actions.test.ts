import { describe, expect, it, beforeEach, vi } from "vitest";
import type { SessionUser } from "@/features/auth/session";
import type { WorkspaceContext } from "@/features/auth/session";
import {
  SETTINGS_RENAME_UNAUTHORIZED_MESSAGE,
  SETTINGS_VALIDATION_MESSAGE,
} from "./messages";
import type { SettingsMutationResult } from "./service";

// -- mocks ----------------------------------------------------------------

class RedirectSignal extends Error {
  constructor(readonly url: string) {
    super(`redirect(${url})`);
    this.name = "RedirectSignal";
  }
}

const requireSessionWorkspaceMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() => vi.fn());
const renameWorkspaceMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/workspace/session-workspace", () => ({
  requireSessionWorkspace: requireSessionWorkspaceMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("./service", () => ({
  renameWorkspace: renameWorkspaceMock,
}));

// -- helpers --------------------------------------------------------------

const USER: SessionUser = { id: "user-1", email: "owner@example.com" };

function workspaceContext(role: "OWNER" | "MANAGER" | "MEMBER"): WorkspaceContext {
  return {
    workspaceId: "ws-1",
    workspaceName: "My Workspace",
    role,
  };
}

function nameForm(name: string) {
  const form = new FormData();
  form.set("name", name);
  return form;
}

function okResult(name: string): SettingsMutationResult {
  return { ok: true, value: { name } };
}

beforeEach(() => {
  requireSessionWorkspaceMock.mockReset();
  redirectMock.mockReset();
  redirectMock.mockImplementation((url: string) => {
    throw new RedirectSignal(url);
  });
  renameWorkspaceMock.mockReset();
});

// -- renameWorkspaceAction ------------------------------------------------

describe("renameWorkspaceAction", () => {
  it("renames the workspace under the server-resolved context and redirects (OWNER)", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("OWNER"),
    });
    renameWorkspaceMock.mockResolvedValue(okResult("New Name"));

    await expect(
      import("./actions").then(({ renameWorkspaceAction }) =>
        renameWorkspaceAction(null, nameForm("New Name"))
      )
    ).rejects.toThrow(RedirectSignal);

    expect(renameWorkspaceMock).toHaveBeenCalledWith(
      "ws-1",
      "OWNER",
      "New Name"
    );
    expect(redirectMock).toHaveBeenCalledWith("/settings");
  });

  it("ignores client-supplied workspaceId and role (server resolves its own context)", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("MEMBER"),
    });
    renameWorkspaceMock.mockResolvedValue(okResult("Evil"));

    // Even if the form contained workspaceId/role overrides, the action uses
    // the session-resolved values.
    const form = new FormData();
    form.set("name", "Evil");
    form.set("workspaceId", "ws-evil");
    form.set("role", "OWNER");

    await expect(
      import("./actions").then(({ renameWorkspaceAction }) =>
        renameWorkspaceAction(null, form)
      )
    ).rejects.toThrow(RedirectSignal);

    expect(renameWorkspaceMock).toHaveBeenCalledWith(
      "ws-1",
      "MEMBER",
      "Evil"
    );
  });

  it("returns unauthorized error when non-OWNER attempts rename", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("MANAGER"),
    });
    renameWorkspaceMock.mockResolvedValue({
      ok: false,
      code: "unauthorized",
    });

    const result = await import("./actions").then(({ renameWorkspaceAction }) =>
      renameWorkspaceAction(null, nameForm("New Name"))
    );

    expect(result).toEqual({ error: SETTINGS_RENAME_UNAUTHORIZED_MESSAGE });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("returns validation error for invalid input", async () => {
    const result = await import("./actions").then(({ renameWorkspaceAction }) =>
      renameWorkspaceAction(null, nameForm(""))
    );

    expect(result).toEqual({
      error: SETTINGS_VALIDATION_MESSAGE,
      fieldErrors: expect.any(Object),
    });
    expect(requireSessionWorkspaceMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
