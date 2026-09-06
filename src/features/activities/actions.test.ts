import { describe, expect, it, beforeEach, vi } from "vitest";
import type { SessionUser } from "@/features/auth/session";
import type { WorkspaceContext } from "@/features/auth/session";
import {
  ACTIVITY_GENERIC_ERROR_MESSAGE,
  ACTIVITY_INVALID_REFERENCE_MESSAGE,
  ACTIVITY_VALIDATION_MESSAGE,
} from "./messages";
import type { Activity, ActivityMutationResult } from "./service";

// -- mocks ----------------------------------------------------------------

class RedirectSignal extends Error {
  constructor(readonly url: string) {
    super(`redirect(${url})`);
    this.name = "RedirectSignal";
  }
}

const requireSessionWorkspaceMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() => vi.fn());
const createActivityMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/workspace/session-workspace", () => ({
  requireSessionWorkspace: requireSessionWorkspaceMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("./service", () => ({
  createActivity: createActivityMock,
}));

// -- helpers --------------------------------------------------------------

const USER: SessionUser = { id: "user-1", email: "member@example.com" };

function workspaceContext(role: "OWNER" | "MANAGER" | "MEMBER"): WorkspaceContext {
  return {
    workspaceId: "ws-1",
    workspaceName: "My Workspace",
    role,
  };
}

function activityForm(
  overrides: Record<string, string> = {}
): FormData {
  const form = new FormData();
  form.set("note", "Called the customer about the deal");
  if (overrides.customerId !== undefined) form.set("customerId", overrides.customerId);
  if (overrides.dealId !== undefined) form.set("dealId", overrides.dealId);
  for (const [key, value] of Object.entries(overrides)) {
    if (key !== "customerId" && key !== "dealId") {
      form.set(key, value);
    }
  }
  return form;
}

const ACTIVITY: Activity = {
  id: "act1a2b3c4d5e6f7g8h9i0j1k2",
  note: "Called the customer about the deal",
  customerId: null,
  dealId: null,
  workspaceId: "ws-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  customer: null,
  deal: null,
};

function okResult(value: Activity): ActivityMutationResult<Activity> {
  return { ok: true, value };
}

beforeEach(() => {
  requireSessionWorkspaceMock.mockReset();
  redirectMock.mockReset();
  redirectMock.mockImplementation((url: string) => {
    throw new RedirectSignal(url);
  });
  createActivityMock.mockReset();
});

// -- createActivityAction ------------------------------------------------

describe("createActivityAction", () => {
  it("creates under the server-resolved workspace and redirects to /activities (AC-ACT-001)", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("MEMBER"),
    });
    createActivityMock.mockResolvedValue(okResult(ACTIVITY));

    await expect(
      import("./actions").then(({ createActivityAction }) =>
        createActivityAction(null, activityForm())
      )
    ).rejects.toThrow(RedirectSignal);

    expect(createActivityMock).toHaveBeenCalledWith("ws-1", {
      note: "Called the customer about the deal",
      customerId: null,
      dealId: null,
    });
    expect(redirectMock).toHaveBeenCalledWith("/activities");
  });

  it("passes customer and deal associations through to the service", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("OWNER"),
    });
    createActivityMock.mockResolvedValue(okResult(ACTIVITY));

    await expect(
      import("./actions").then(({ createActivityAction }) =>
        createActivityAction(
          null,
          activityForm({ customerId: "cust-123", dealId: "deal-456" })
        )
      )
    ).rejects.toThrow(RedirectSignal);

    expect(createActivityMock).toHaveBeenCalledWith("ws-1", {
      note: "Called the customer about the deal",
      customerId: "cust-123",
      dealId: "deal-456",
    });
  });

  it("ignores client-supplied workspaceId (server resolves its own context)", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("MEMBER"),
    });
    createActivityMock.mockResolvedValue(okResult(ACTIVITY));

    // Even if the form contained a workspaceId, the action ignores it.
    const form = activityForm({ workspaceId: "ws-evil" });
    await expect(
      import("./actions").then(({ createActivityAction }) =>
        createActivityAction(null, form)
      )
    ).rejects.toThrow(RedirectSignal);

    expect(createActivityMock).toHaveBeenCalledWith(
      "ws-1",
      expect.objectContaining({ note: expect.any(String) })
    );
  });

  it("returns field errors for missing note", async () => {
    const form = new FormData();
    // No note field.

    const result = await import("./actions").then(({ createActivityAction }) =>
      createActivityAction(null, form)
    );

    expect(result).toEqual({
      error: ACTIVITY_VALIDATION_MESSAGE,
      fieldErrors: expect.any(Object),
    });
    expect(requireSessionWorkspaceMock).not.toHaveBeenCalled();
  });

  it("returns invalid_reference error when service rejects the reference", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("MEMBER"),
    });
    createActivityMock.mockResolvedValue({
      ok: false,
      code: "invalid_reference",
    });

    const result = await import("./actions").then(({ createActivityAction }) =>
      createActivityAction(null, activityForm({ customerId: "foreign-cust" }))
    );

    expect(result).toEqual({ error: ACTIVITY_INVALID_REFERENCE_MESSAGE });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("returns generic error for unexpected service failures", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("MEMBER"),
    });
    createActivityMock.mockResolvedValue({
      ok: false,
      code: "invalid_input",
    });

    const result = await import("./actions").then(({ createActivityAction }) =>
      createActivityAction(null, activityForm())
    );

    expect(result).toEqual({ error: ACTIVITY_GENERIC_ERROR_MESSAGE });
  });

  it("works for all roles (OWNER, MANAGER, MEMBER can create activities)", async () => {
    for (const role of ["OWNER", "MANAGER", "MEMBER"] as const) {
      requireSessionWorkspaceMock.mockResolvedValue({
        user: USER,
        workspace: workspaceContext(role),
      });
      createActivityMock.mockResolvedValue(okResult(ACTIVITY));
      redirectMock.mockClear();

      await expect(
        import("./actions").then(({ createActivityAction }) =>
          createActivityAction(null, activityForm())
        )
      ).rejects.toThrow(RedirectSignal);

      expect(redirectMock).toHaveBeenCalledWith("/activities");
    }
  });
});
