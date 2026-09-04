import { describe, expect, it, beforeEach, vi } from "vitest";
import type { SessionUser, WorkspaceContext } from "@/features/auth/session";
import {
  DEAL_CONFLICT_MESSAGE,
  DEAL_GENERIC_ERROR_MESSAGE,
  DEAL_INVALID_CUSTOMER_MESSAGE,
  DEAL_NOT_FOUND_MESSAGE,
  DEAL_UNAUTHORIZED_DELETE_MESSAGE,
  DEAL_VALIDATION_MESSAGE,
} from "./messages";
import type { Deal, DealMutationResult } from "./service";

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
const createDealMock = vi.hoisted(() => vi.fn());
const updateDealMock = vi.hoisted(() => vi.fn());
const deleteDealMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/workspace/session-workspace", () => ({
  requireSessionWorkspace: requireSessionWorkspaceMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
}));

vi.mock("./service", () => ({
  createDeal: createDealMock,
  updateDeal: updateDealMock,
  deleteDeal: deleteDealMock,
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

function dealForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  form.set("title", "Enterprise onboarding");
  form.set("stage", "NEW");
  form.set("customerId", "");
  for (const [key, value] of Object.entries(overrides)) {
    form.set(key, value);
  }
  return form;
}

const DEAL: Deal = {
  id: "dl1a2b3c4d5e6f7g8h9i0j1k2",
  title: "Enterprise onboarding",
  stage: "NEW",
  customerId: null,
  workspaceId: "ws-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  customer: null,
};

function okResult<T>(value: T): DealMutationResult<T> {
  return { ok: true, value };
}

beforeEach(() => {
  requireSessionWorkspaceMock.mockReset();
  redirectMock.mockReset();
  redirectMock.mockImplementation((url: string) => {
    throw new RedirectSignal(url);
  });
  notFoundMock.mockReset();
  createDealMock.mockReset();
  updateDealMock.mockReset();
  deleteDealMock.mockReset();
});

// -- createDealAction ----------------------------------------------------

describe("createDealAction", () => {
  it("creates under the server-resolved workspace and redirects to the detail page (AC-DEAL-002)", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("MEMBER"),
    });
    createDealMock.mockResolvedValue(okResult(DEAL));

    await expect(
      import("./actions").then(({ createDealAction }) =>
        createDealAction(null, dealForm())
      )
    ).rejects.toThrow(RedirectSignal);

    // Called with the session workspace id and normalized fields.
    expect(createDealMock).toHaveBeenCalledWith("ws-1", {
      title: "Enterprise onboarding",
      stage: "NEW",
      customerId: null,
    });
    expect(redirectMock).toHaveBeenCalledWith(`/deals/${DEAL.id}`);
  });

  it("ignores client-supplied workspaceId, role and userId (server resolves its own context)", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("OWNER"),
    });
    createDealMock.mockResolvedValue(okResult(DEAL));

    const form = dealForm({
      workspaceId: "ws-evil",
      role: "OWNER",
      userId: "attacker-id",
    });
    await expect(
      import("./actions").then(({ createDealAction }) =>
        createDealAction(null, form)
      )
    ).rejects.toThrow(RedirectSignal);

    // The workspace used is the session-resolved one, not the client's.
    expect(createDealMock.mock.calls[0][0]).toBe("ws-1");
  });

  it("returns field errors for invalid input without calling the service", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("OWNER"),
    });
    const state = await import("./actions").then(({ createDealAction }) =>
      createDealAction(null, dealForm({ title: "", stage: "" }))
    );
    expect(state?.error).toBe(DEAL_VALIDATION_MESSAGE);
    expect(state?.fieldErrors?.title).toBeTruthy();
    expect(state?.fieldErrors?.stage).toBeTruthy();
    expect(createDealMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid stage server-side", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("OWNER"),
    });
    const state = await import("./actions").then(({ createDealAction }) =>
      createDealAction(null, dealForm({ stage: "BOGUS" }))
    );
    expect(state?.error).toBe(DEAL_VALIDATION_MESSAGE);
    expect(state?.fieldErrors?.stage).toBeTruthy();
    expect(createDealMock).not.toHaveBeenCalled();
  });

  it("surfaces an invalid-customer error", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("OWNER"),
    });
    createDealMock.mockResolvedValue({ ok: false, code: "invalid_customer" });
    const state = await import("./actions").then(({ createDealAction }) =>
      createDealAction(null, dealForm())
    );
    expect(state?.error).toBe(DEAL_INVALID_CUSTOMER_MESSAGE);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("propagates the session requirement (unauthenticated → login redirect, non-member → notFound)", async () => {
    requireSessionWorkspaceMock.mockRejectedValue(new RedirectSignal("/login"));
    await expect(
      import("./actions").then(({ createDealAction }) =>
        createDealAction(null, dealForm())
      )
    ).rejects.toThrow(RedirectSignal);

    requireSessionWorkspaceMock.mockRejectedValue(new NotFoundSignal());
    await expect(
      import("./actions").then(({ createDealAction }) =>
        createDealAction(null, dealForm())
      )
    ).rejects.toThrow(NotFoundSignal);
  });
});

// -- updateDealAction ----------------------------------------------------

describe("updateDealAction", () => {
  it("updates via the server-resolved workspace and redirects to the detail page (AC-DEAL-003)", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("MEMBER"),
    });
    updateDealMock.mockResolvedValue(okResult(DEAL));

    const form = dealForm({
      dealId: DEAL.id,
      expectedUpdatedAt: DEAL.updatedAt.toISOString(),
      stage: "PROPOSAL",
    });
    await expect(
      import("./actions").then(({ updateDealAction }) =>
        updateDealAction(null, form)
      )
    ).rejects.toThrow(RedirectSignal);

    expect(updateDealMock).toHaveBeenCalledWith(
      "ws-1",
      DEAL.id,
      expect.objectContaining({ title: "Enterprise onboarding", stage: "PROPOSAL" }),
      DEAL.updatedAt
    );
    expect(redirectMock).toHaveBeenCalledWith(`/deals/${DEAL.id}`);
  });

  it("reports a stale-timestamp conflict (concurrent update)", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("OWNER"),
    });
    updateDealMock.mockResolvedValue({ ok: false, code: "conflict" });
    const state = await import("./actions").then(({ updateDealAction }) =>
      updateDealAction(
        null,
        dealForm({
          dealId: DEAL.id,
          expectedUpdatedAt: DEAL.updatedAt.toISOString(),
        })
      )
    );
    expect(state?.error).toBe(DEAL_CONFLICT_MESSAGE);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("reports not_found for a missing/foreign deal", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("OWNER"),
    });
    updateDealMock.mockResolvedValue({ ok: false, code: "not_found" });
    const state = await import("./actions").then(({ updateDealAction }) =>
      updateDealAction(
        null,
        dealForm({ dealId: "missing", expectedUpdatedAt: new Date().toISOString() })
      )
    );
    expect(state?.error).toBe(DEAL_NOT_FOUND_MESSAGE);
  });

  it("rejects an invalid deal id", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("OWNER"),
    });
    const state = await import("./actions").then(({ updateDealAction }) =>
      updateDealAction(
        null,
        dealForm({ dealId: "invalid id !!", expectedUpdatedAt: new Date().toISOString() })
      )
    );
    expect(state?.error).toBe(DEAL_VALIDATION_MESSAGE);
    expect(updateDealMock).not.toHaveBeenCalled();
  });
});

// -- deleteDealAction ----------------------------------------------------

describe("deleteDealAction", () => {
  it("rejects MEMBER deletion server-side without touching data (AC-DEAL-005, BR-DEAL-005)", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("MEMBER"),
    });
    const state = await import("./actions").then(({ deleteDealAction }) =>
      deleteDealAction(null, dealForm({ dealId: DEAL.id }))
    );
    expect(state?.error).toBe(DEAL_UNAUTHORIZED_DELETE_MESSAGE);
    expect(deleteDealMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("deletes for OWNER and redirects to the list (AC-DEAL-004)", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("OWNER"),
    });
    deleteDealMock.mockResolvedValue(okResult(null));

    await expect(
      import("./actions").then(({ deleteDealAction }) =>
        deleteDealAction(null, dealForm({ dealId: DEAL.id }))
      )
    ).rejects.toThrow(RedirectSignal);

    expect(deleteDealMock).toHaveBeenCalledWith("ws-1", DEAL.id);
    expect(redirectMock).toHaveBeenCalledWith("/deals");
  });

  it("deletes for MANAGER (BR-DEAL-004)", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("MANAGER"),
    });
    deleteDealMock.mockResolvedValue(okResult(null));
    await expect(
      import("./actions").then(({ deleteDealAction }) =>
        deleteDealAction(null, dealForm({ dealId: DEAL.id }))
      )
    ).rejects.toThrow(RedirectSignal);
    expect(deleteDealMock).toHaveBeenCalled();
  });

  it("redirects to the list when the deal is already gone (idempotent)", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("OWNER"),
    });
    deleteDealMock.mockResolvedValue({ ok: false, code: "not_found" });
    await expect(
      import("./actions").then(({ deleteDealAction }) =>
        deleteDealAction(null, dealForm({ dealId: DEAL.id }))
      )
    ).rejects.toThrow(RedirectSignal);
    expect(redirectMock).toHaveBeenCalledWith("/deals");
  });

  it("ignores a client-supplied role of OWNER when the session role is MEMBER", async () => {
    // Even if the payload asserts OWNER, the server-resolved membership is
    // MEMBER → deletion is rejected before any data access.
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("MEMBER"),
    });
    const state = await import("./actions").then(({ deleteDealAction }) =>
      deleteDealAction(null, dealForm({ dealId: DEAL.id, role: "OWNER" }))
    );
    expect(state?.error).toBe(DEAL_UNAUTHORIZED_DELETE_MESSAGE);
    expect(deleteDealMock).not.toHaveBeenCalled();
  });

  it("maps an unexpected mutation failure to the generic error", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("OWNER"),
    });
    deleteDealMock.mockResolvedValue({ ok: false, code: "invalid_input" });
    const state = await import("./actions").then(({ deleteDealAction }) =>
      deleteDealAction(null, dealForm({ dealId: DEAL.id }))
    );
    expect(state?.error).toBe(DEAL_GENERIC_ERROR_MESSAGE);
  });
});
