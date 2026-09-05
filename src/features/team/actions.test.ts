import { describe, expect, it, beforeEach, vi } from "vitest";
import type { SessionUser, WorkspaceContext } from "@/features/auth/session";
import {
  TEAM_ALREADY_MEMBER_MESSAGE,
  TEAM_CANNOT_ASSIGN_OWNER_ROLE_MESSAGE,
  TEAM_CANNOT_CHANGE_OWN_ROLE_MESSAGE,
  TEAM_CANNOT_CHANGE_OWNER_MESSAGE,
  TEAM_CANNOT_REMOVE_OWNER_MESSAGE,
  TEAM_INVITE_UNAUTHORIZED_MESSAGE,
  TEAM_LAST_OWNER_MESSAGE,
  TEAM_MEMBER_NOT_FOUND_MESSAGE,
  TEAM_REMOVE_UNAUTHORIZED_MESSAGE,
  TEAM_ROLE_UNAUTHORIZED_MESSAGE,
  TEAM_USER_NOT_FOUND_MESSAGE,
  TEAM_VALIDATION_MESSAGE,
} from "./messages";
import type { TeamMember, TeamMutationResult } from "./service";

// -- mocks ---------------------------------------------------------------

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

const requireSessionWorkspaceMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() => vi.fn());
const notFoundMock = vi.hoisted(() => vi.fn());
const inviteMemberMock = vi.hoisted(() => vi.fn());
const changeMemberRoleMock = vi.hoisted(() => vi.fn());
const removeMemberMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/workspace/session-workspace", () => ({
  requireSessionWorkspace: requireSessionWorkspaceMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
}));

vi.mock("./service", () => ({
  inviteMember: inviteMemberMock,
  changeMemberRole: changeMemberRoleMock,
  removeMember: removeMemberMock,
}));

// -- helpers -------------------------------------------------------------

const USER: SessionUser = { id: "user-1", email: "member@example.com" };

function workspaceContext(role: "OWNER" | "MANAGER" | "MEMBER"): WorkspaceContext {
  return {
    workspaceId: "ws-1",
    workspaceName: "My Workspace",
    role,
  };
}

function inviteForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  form.set("email", "newbie@example.com");
  form.set("role", "MEMBER");
  for (const [key, value] of Object.entries(overrides)) {
    form.set(key, value);
  }
  return form;
}

function roleForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  form.set("membershipId", "ms-1");
  form.set("role", "MANAGER");
  for (const [key, value] of Object.entries(overrides)) {
    form.set(key, value);
  }
  return form;
}

function removeForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  form.set("membershipId", "ms-1");
  for (const [key, value] of Object.entries(overrides)) {
    form.set(key, value);
  }
  return form;
}

const MEMBER: TeamMember = {
  id: "ms-1",
  userId: "user-2",
  email: "newbie@example.com",
  role: "MEMBER",
  createdAt: new Date(),
};

function okResult<T>(value: T): TeamMutationResult<T> {
  return { ok: true, value };
}

beforeEach(() => {
  requireSessionWorkspaceMock.mockReset();
  redirectMock.mockReset();
  redirectMock.mockImplementation((url: string) => {
    throw new RedirectSignal(url);
  });
  notFoundMock.mockReset();
  inviteMemberMock.mockReset();
  changeMemberRoleMock.mockReset();
  removeMemberMock.mockReset();
});

// -- inviteMemberAction --------------------------------------------------

describe("inviteMemberAction", () => {
  it("invites via the server-resolved workspace and redirects to /team (AC-TEAM-002)", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("OWNER"),
    });
    inviteMemberMock.mockResolvedValue(okResult(MEMBER));

    await expect(
      import("./actions").then(({ inviteMemberAction }) =>
        inviteMemberAction(null, inviteForm())
      )
    ).rejects.toThrow(RedirectSignal);

    expect(inviteMemberMock).toHaveBeenCalledWith("ws-1", "OWNER", {
      email: "newbie@example.com",
      role: "MEMBER",
    });
    expect(redirectMock).toHaveBeenCalledWith("/team");
  });

  it("ignores client-supplied workspaceId and userId (server resolves its own context)", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("OWNER"),
    });
    inviteMemberMock.mockResolvedValue(okResult(MEMBER));

    const form = inviteForm({ workspaceId: "ws-evil", userId: "user-evil" });
    await expect(
      import("./actions").then(({ inviteMemberAction }) =>
        inviteMemberAction(null, form)
      )
    ).rejects.toThrow(RedirectSignal);

    // The workspace used for the invite is the session-resolved one.
    expect(inviteMemberMock.mock.calls[0][0]).toBe("ws-1");
    expect(inviteMemberMock.mock.calls[0][1]).toBe("OWNER");
  });

  it("returns field errors for invalid input without calling the service", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("OWNER"),
    });
    const state = await import("./actions").then(({ inviteMemberAction }) =>
      inviteMemberAction(null, inviteForm({ email: "bad", role: "ADMIN" }))
    );
    expect(state?.error).toBe(TEAM_VALIDATION_MESSAGE);
    expect(state?.fieldErrors?.email).toBeTruthy();
    expect(state?.fieldErrors?.role).toBeTruthy();
    expect(inviteMemberMock).not.toHaveBeenCalled();
  });

  it("rejects a MEMBER inviter server-side, even with a tampered OWNER role request (AC-TEAM-003)", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("MEMBER"),
    });
    const state = await import("./actions").then(({ inviteMemberAction }) =>
      inviteMemberAction(null, inviteForm({ role: "OWNER" }))
    );
    expect(state?.error).toBe(TEAM_INVITE_UNAUTHORIZED_MESSAGE);
    expect(inviteMemberMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("maps service failures to safe messages", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("OWNER"),
    });
    const cases: Array<[TeamMutationResult<TeamMember>, string]> = [
      [{ ok: false, code: "user_not_found" }, TEAM_USER_NOT_FOUND_MESSAGE],
      [{ ok: false, code: "already_member" }, TEAM_ALREADY_MEMBER_MESSAGE],
      [{ ok: false, code: "cannot_assign_owner" }, TEAM_CANNOT_ASSIGN_OWNER_ROLE_MESSAGE],
    ];
    for (const [result, message] of cases) {
      inviteMemberMock.mockResolvedValue(result);
      const state = await import("./actions").then(({ inviteMemberAction }) =>
        inviteMemberAction(null, inviteForm())
      );
      expect(state?.error).toBe(message);
      expect(redirectMock).not.toHaveBeenCalled();
    }
  });

  it("propagates the session requirement (unauthenticated → login, non-member → notFound)", async () => {
    requireSessionWorkspaceMock.mockRejectedValue(new RedirectSignal("/login"));
    await expect(
      import("./actions").then(({ inviteMemberAction }) =>
        inviteMemberAction(null, inviteForm())
      )
    ).rejects.toThrow(RedirectSignal);

    requireSessionWorkspaceMock.mockRejectedValue(new NotFoundSignal());
    await expect(
      import("./actions").then(({ inviteMemberAction }) =>
        inviteMemberAction(null, inviteForm())
      )
    ).rejects.toThrow(NotFoundSignal);
  });
});

// -- changeMemberRoleAction ----------------------------------------------

describe("changeMemberRoleAction", () => {
  it("changes the role via the server-resolved context and redirects (AC-TEAM-004)", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("OWNER"),
    });
    changeMemberRoleMock.mockResolvedValue(okResult({ ...MEMBER, role: "MANAGER" }));

    await expect(
      import("./actions").then(({ changeMemberRoleAction }) =>
        changeMemberRoleAction(null, roleForm())
      )
    ).rejects.toThrow(RedirectSignal);

    expect(changeMemberRoleMock).toHaveBeenCalledWith(
      "ws-1",
      USER.id,
      "OWNER",
      "ms-1",
      "MANAGER"
    );
    expect(redirectMock).toHaveBeenCalledWith("/team");
  });

  it("rejects a MEMBER role change server-side without touching data (AC-TEAM-005)", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("MEMBER"),
    });
    const state = await import("./actions").then(({ changeMemberRoleAction }) =>
      changeMemberRoleAction(null, roleForm())
    );
    expect(state?.error).toBe(TEAM_ROLE_UNAUTHORIZED_MESSAGE);
    expect(changeMemberRoleMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("passes the server-resolved MANAGER role to the service (role from session, not the client)", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("MANAGER"),
    });
    changeMemberRoleMock.mockResolvedValue(okResult({ ...MEMBER, role: "MANAGER" }));

    // The form requests the OWNER role; the actor is a MANAGER. The action
    // forwards the request to the service with the server-resolved MANAGER
    // role — the service rejects it (cannot_assign_owner), so a client cannot
    // escalate by tampering with the form.
    await expect(
      import("./actions").then(({ changeMemberRoleAction }) =>
        changeMemberRoleAction(null, roleForm({ role: "OWNER" }))
      )
    ).rejects.toThrow(RedirectSignal);

    expect(changeMemberRoleMock).toHaveBeenCalledWith(
      "ws-1",
      USER.id,
      "MANAGER",
      "ms-1",
      "OWNER"
    );
  });

  it("returns field errors for invalid input without calling the service", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("OWNER"),
    });
    const state = await import("./actions").then(({ changeMemberRoleAction }) =>
      changeMemberRoleAction(null, roleForm({ membershipId: "", role: "ADMIN" }))
    );
    expect(state?.error).toBe(TEAM_VALIDATION_MESSAGE);
    expect(state?.fieldErrors?.membershipId).toBeTruthy();
    expect(state?.fieldErrors?.role).toBeTruthy();
    expect(changeMemberRoleMock).not.toHaveBeenCalled();
  });

  it("maps service failures to safe messages", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("OWNER"),
    });
    const cases: Array<[TeamMutationResult<TeamMember>, string]> = [
      [{ ok: false, code: "not_found" }, TEAM_MEMBER_NOT_FOUND_MESSAGE],
      [{ ok: false, code: "cannot_change_owner" }, TEAM_CANNOT_CHANGE_OWNER_MESSAGE],
      [{ ok: false, code: "cannot_assign_owner" }, TEAM_CANNOT_ASSIGN_OWNER_ROLE_MESSAGE],
      [{ ok: false, code: "own_membership" }, TEAM_CANNOT_CHANGE_OWN_ROLE_MESSAGE],
      [{ ok: false, code: "last_owner" }, TEAM_LAST_OWNER_MESSAGE],
    ];
    for (const [result, message] of cases) {
      changeMemberRoleMock.mockResolvedValue(result);
      const state = await import("./actions").then(({ changeMemberRoleAction }) =>
        changeMemberRoleAction(null, roleForm())
      );
      expect(state?.error).toBe(message);
      expect(redirectMock).not.toHaveBeenCalled();
    }
  });
});

// -- removeMemberAction --------------------------------------------------

describe("removeMemberAction", () => {
  it("removes for an OWNER and redirects to /team (AC-TEAM-006)", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("OWNER"),
    });
    removeMemberMock.mockResolvedValue(okResult(null));

    await expect(
      import("./actions").then(({ removeMemberAction }) =>
        removeMemberAction(null, removeForm())
      )
    ).rejects.toThrow(RedirectSignal);

    expect(removeMemberMock).toHaveBeenCalledWith("ws-1", "OWNER", "ms-1");
    expect(redirectMock).toHaveBeenCalledWith("/team");
  });

  it("rejects MANAGER and MEMBER removal server-side without touching data (BR-TEAM-008)", async () => {
    for (const role of ["MANAGER", "MEMBER"] as const) {
      requireSessionWorkspaceMock.mockResolvedValue({
        user: USER,
        workspace: workspaceContext(role),
      });
      const state = await import("./actions").then(({ removeMemberAction }) =>
        removeMemberAction(null, removeForm())
      );
      expect(state?.error).toBe(TEAM_REMOVE_UNAUTHORIZED_MESSAGE);
      expect(removeMemberMock).not.toHaveBeenCalled();
      expect(redirectMock).not.toHaveBeenCalled();
    }
  });

  it("maps owner-protection and not-found failures", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("OWNER"),
    });

    removeMemberMock.mockResolvedValue({ ok: false, code: "cannot_remove_owner" });
    const ownerState = await import("./actions").then(({ removeMemberAction }) =>
      removeMemberAction(null, removeForm())
    );
    expect(ownerState?.error).toBe(TEAM_CANNOT_REMOVE_OWNER_MESSAGE);

    removeMemberMock.mockResolvedValue({ ok: false, code: "not_found" });
    const notFoundState = await import("./actions").then(({ removeMemberAction }) =>
      removeMemberAction(null, removeForm())
    );
    expect(notFoundState?.error).toBe(TEAM_MEMBER_NOT_FOUND_MESSAGE);
  });

  it("treats an invalid membership id as member-not-found without calling the service", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("OWNER"),
    });
    const state = await import("./actions").then(({ removeMemberAction }) =>
      removeMemberAction(null, removeForm({ membershipId: "bad id!!" }))
    );
    expect(state?.error).toBe(TEAM_MEMBER_NOT_FOUND_MESSAGE);
    expect(removeMemberMock).not.toHaveBeenCalled();
  });
});