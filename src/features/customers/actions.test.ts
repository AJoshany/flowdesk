import { describe, expect, it, beforeEach, vi } from "vitest";
import type { SessionUser } from "@/features/auth/session";
import type { WorkspaceContext } from "@/features/auth/session";
import {
  CUSTOMER_CONFLICT_MESSAGE,
  CUSTOMER_DUPLICATE_MESSAGE,
  CUSTOMER_NOT_FOUND_MESSAGE,
  CUSTOMER_UNAUTHORIZED_DELETE_MESSAGE,
  CUSTOMER_VALIDATION_MESSAGE,
} from "./messages";
import type { Customer, CustomerMutationResult } from "./service";

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
const createCustomerMock = vi.hoisted(() => vi.fn());
const updateCustomerMock = vi.hoisted(() => vi.fn());
const deleteCustomerMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/workspace/session-workspace", () => ({
  requireSessionWorkspace: requireSessionWorkspaceMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
}));

vi.mock("./service", () => ({
  createCustomer: createCustomerMock,
  updateCustomer: updateCustomerMock,
  deleteCustomer: deleteCustomerMock,
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

function customerForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  form.set("name", "Acme Inc");
  form.set("email", "billing@acme.example");
  form.set("phone", "");
  form.set("company", "");
  for (const [key, value] of Object.entries(overrides)) {
    form.set(key, value);
  }
  return form;
}

const CUSTOMER: Customer = {
  id: "cm1a2b3c4d5e6f7g8h9i0j1k2",
  name: "Acme Inc",
  email: "billing@acme.example",
  phone: null,
  company: null,
  workspaceId: "ws-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

function okResult<T>(value: T): CustomerMutationResult<T> {
  return { ok: true, value };
}

beforeEach(() => {
  requireSessionWorkspaceMock.mockReset();
  redirectMock.mockReset();
  redirectMock.mockImplementation((url: string) => {
    throw new RedirectSignal(url);
  });
  notFoundMock.mockReset();
  createCustomerMock.mockReset();
  updateCustomerMock.mockReset();
  deleteCustomerMock.mockReset();
});

// -- createCustomerAction ------------------------------------------------

describe("createCustomerAction", () => {
  it("creates under the server-resolved workspace and redirects to the detail page (AC-CUST-002)", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("MEMBER"),
    });
    createCustomerMock.mockResolvedValue(okResult(CUSTOMER));

    await expect(
      import("./actions").then(({ createCustomerAction }) =>
        createCustomerAction(null, customerForm())
      )
    ).rejects.toThrow(RedirectSignal);

    // Called with the session workspace id and normalized fields.
    expect(createCustomerMock).toHaveBeenCalledWith("ws-1", {
      name: "Acme Inc",
      email: "billing@acme.example",
      phone: null,
      company: null,
    });
    expect(redirectMock).toHaveBeenCalledWith(`/customers/${CUSTOMER.id}`);
  });

  it("ignores client-supplied workspaceId and role (server resolves its own context)", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("OWNER"),
    });
    createCustomerMock.mockResolvedValue(okResult(CUSTOMER));

    const form = customerForm({ workspaceId: "ws-evil", role: "OWNER" });
    await expect(
      import("./actions").then(({ createCustomerAction }) =>
        createCustomerAction(null, form)
      )
    ).rejects.toThrow(RedirectSignal);

    // The workspace used is the session-resolved one, not the client's.
    expect(createCustomerMock).toHaveBeenCalledWith(
      "ws-1",
      expect.objectContaining({ name: "Acme Inc" })
    );
    expect(createCustomerMock.mock.calls[0][0]).toBe("ws-1");
  });

  it("returns field errors for invalid input without calling the service", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("OWNER"),
    });
    const state = await import("./actions").then(({ createCustomerAction }) =>
      createCustomerAction(null, customerForm({ name: "", email: "bad" }))
    );
    expect(state?.error).toBe(CUSTOMER_VALIDATION_MESSAGE);
    expect(state?.fieldErrors?.name).toBeTruthy();
    expect(state?.fieldErrors?.email).toBeTruthy();
    expect(createCustomerMock).not.toHaveBeenCalled();
  });

  it("surfaces a duplicate-email error", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("OWNER"),
    });
    createCustomerMock.mockResolvedValue({ ok: false, code: "duplicate" });
    const state = await import("./actions").then(({ createCustomerAction }) =>
      createCustomerAction(null, customerForm())
    );
    expect(state?.error).toBe(CUSTOMER_DUPLICATE_MESSAGE);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("propagates the session requirement (unauthenticated → login redirect, non-member → notFound)", async () => {
    requireSessionWorkspaceMock.mockRejectedValue(new RedirectSignal("/login"));
    await expect(
      import("./actions").then(({ createCustomerAction }) =>
        createCustomerAction(null, customerForm())
      )
    ).rejects.toThrow(RedirectSignal);

    requireSessionWorkspaceMock.mockRejectedValue(new NotFoundSignal());
    await expect(
      import("./actions").then(({ createCustomerAction }) =>
        createCustomerAction(null, customerForm())
      )
    ).rejects.toThrow(NotFoundSignal);
  });
});

// -- updateCustomerAction ------------------------------------------------

describe("updateCustomerAction", () => {
  it("updates via the server-resolved workspace and redirects to the detail page (AC-CUST-003)", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("MEMBER"),
    });
    updateCustomerMock.mockResolvedValue(okResult(CUSTOMER));

    const form = customerForm({
      customerId: CUSTOMER.id,
      expectedUpdatedAt: CUSTOMER.updatedAt.toISOString(),
    });
    await expect(
      import("./actions").then(({ updateCustomerAction }) =>
        updateCustomerAction(null, form)
      )
    ).rejects.toThrow(RedirectSignal);

    expect(updateCustomerMock).toHaveBeenCalledWith(
      "ws-1",
      CUSTOMER.id,
      expect.objectContaining({ name: "Acme Inc" }),
      CUSTOMER.updatedAt
    );
    expect(redirectMock).toHaveBeenCalledWith(`/customers/${CUSTOMER.id}`);
  });

  it("reports a stale-timestamp conflict (concurrent update)", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("OWNER"),
    });
    updateCustomerMock.mockResolvedValue({ ok: false, code: "conflict" });
    const state = await import("./actions").then(({ updateCustomerAction }) =>
      updateCustomerAction(
        null,
        customerForm({
          customerId: CUSTOMER.id,
          expectedUpdatedAt: CUSTOMER.updatedAt.toISOString(),
        })
      )
    );
    expect(state?.error).toBe(CUSTOMER_CONFLICT_MESSAGE);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("reports not_found for a missing/foreign customer", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("OWNER"),
    });
    updateCustomerMock.mockResolvedValue({ ok: false, code: "not_found" });
    const state = await import("./actions").then(({ updateCustomerAction }) =>
      updateCustomerAction(
        null,
        customerForm({
          customerId: "missing",
          expectedUpdatedAt: new Date().toISOString(),
        })
      )
    );
    expect(state?.error).toBe(CUSTOMER_NOT_FOUND_MESSAGE);
  });

  it("rejects an invalid customer id", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("OWNER"),
    });
    const state = await import("./actions").then(({ updateCustomerAction }) =>
      updateCustomerAction(
        null,
        customerForm({ customerId: "invalid id !!", expectedUpdatedAt: new Date().toISOString() })
      )
    );
    expect(state?.error).toBe(CUSTOMER_VALIDATION_MESSAGE);
    expect(updateCustomerMock).not.toHaveBeenCalled();
  });
});

// -- deleteCustomerAction ------------------------------------------------

describe("deleteCustomerAction", () => {
  it("rejects MEMBER deletion server-side without touching data (AC-CUST-005, BR-CUST-004)", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("MEMBER"),
    });
    const state = await import("./actions").then(({ deleteCustomerAction }) =>
      deleteCustomerAction(null, customerForm({ customerId: CUSTOMER.id }))
    );
    expect(state?.error).toBe(CUSTOMER_UNAUTHORIZED_DELETE_MESSAGE);
    expect(deleteCustomerMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("deletes for OWNER and redirects to the list (AC-CUST-004)", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("OWNER"),
    });
    deleteCustomerMock.mockResolvedValue(okResult(null));

    await expect(
      import("./actions").then(({ deleteCustomerAction }) =>
        deleteCustomerAction(null, customerForm({ customerId: CUSTOMER.id }))
      )
    ).rejects.toThrow(RedirectSignal);

    expect(deleteCustomerMock).toHaveBeenCalledWith("ws-1", CUSTOMER.id);
    expect(redirectMock).toHaveBeenCalledWith("/customers");
  });

  it("deletes for MANAGER (BR-CUST-003)", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("MANAGER"),
    });
    deleteCustomerMock.mockResolvedValue(okResult(null));
    await expect(
      import("./actions").then(({ deleteCustomerAction }) =>
        deleteCustomerAction(null, customerForm({ customerId: CUSTOMER.id }))
      )
    ).rejects.toThrow(RedirectSignal);
    expect(deleteCustomerMock).toHaveBeenCalled();
  });

  it("redirects to the list when the customer is already gone (idempotent, §9 edge case)", async () => {
    requireSessionWorkspaceMock.mockResolvedValue({
      user: USER,
      workspace: workspaceContext("OWNER"),
    });
    deleteCustomerMock.mockResolvedValue({ ok: false, code: "not_found" });
    await expect(
      import("./actions").then(({ deleteCustomerAction }) =>
        deleteCustomerAction(null, customerForm({ customerId: CUSTOMER.id }))
      )
    ).rejects.toThrow(RedirectSignal);
    expect(redirectMock).toHaveBeenCalledWith("/customers");
  });
});