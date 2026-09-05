import { describe, expect, it, beforeEach, vi } from "vitest";
import { AuthError } from "next-auth";
import {
  DUPLICATE_ACCOUNT_MESSAGE,
  GENERIC_ERROR_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
} from "./messages";
import { loginAction, logoutAction, registerAction } from "./actions";
import type { RegistrationResult } from "./services";

// -- mocks ---------------------------------------------------------------

class RedirectSignal extends Error {
  constructor(readonly url: string) {
    super(`redirect(${url})`);
    this.name = "RedirectSignal";
  }
}

const signInMock = vi.hoisted(() => vi.fn());
const signOutMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() => vi.fn());
const registerUserMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({
  auth: vi.fn(),
  signIn: signInMock,
  signOut: signOutMock,
  handlers: {},
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));

vi.mock("./services", () => ({
  registerUser: registerUserMock,
  DEFAULT_WORKSPACE_NAME: "My Workspace",
}));

function makeForm(overrides: { email?: string; password?: string; callbackUrl?: string }) {
  const form = new FormData();
  if (overrides.email !== undefined) form.set("email", overrides.email);
  if (overrides.password !== undefined) form.set("password", overrides.password);
  if (overrides.callbackUrl !== undefined) {
    form.set("callbackUrl", overrides.callbackUrl);
  }
  return form;
}

function expectRedirect(url: string) {
  expect(redirectMock).toHaveBeenCalledWith(url);
}

// -- loginAction ---------------------------------------------------------

describe("loginAction", () => {
  beforeEach(() => {
    signInMock.mockReset();
    redirectMock.mockReset();
    redirectMock.mockImplementation((url: string) => {
      throw new RedirectSignal(url);
    });
  });

  it("delegates to Auth.js signIn and redirects to /dashboard on success (AC-AUTH-003)", async () => {
    signInMock.mockResolvedValue(undefined);
    await expect(
      loginAction(null, makeForm({ email: "user@example.com", password: "password" }))
    ).rejects.toThrow(RedirectSignal);
    expect(signInMock).toHaveBeenCalledWith("credentials", {
      email: "user@example.com",
      password: "password",
      redirect: false,
    });
    expectRedirect("/dashboard");
  });

  it("honors an internal callbackUrl", async () => {
    signInMock.mockResolvedValue(undefined);
    await expect(
      loginAction(
        null,
        makeForm({
          email: "user@example.com",
          password: "password",
          callbackUrl: "/customers",
        })
      )
    ).rejects.toThrow(RedirectSignal);
    expectRedirect("/customers");
  });

  it("never redirects to an external or protocol-relative URL (open-redirect guard)", async () => {
    signInMock.mockResolvedValue(undefined);
    for (const evil of ["https://evil.example.com", "//evil.example.com", "/\\evil"]) {
      redirectMock.mockClear();
      await expect(
        loginAction(
          null,
          makeForm({ email: "user@example.com", password: "password", callbackUrl: evil })
        )
      ).rejects.toThrow(RedirectSignal);
      expectRedirect("/dashboard");
    }
  });

  it("returns the generic error for invalid format and never calls signIn", async () => {
    const state = await loginAction(
      null,
      makeForm({ email: "not-an-email", password: "" })
    );
    expect(state).toMatchObject({ error: INVALID_CREDENTIALS_MESSAGE });
    expect(signInMock).not.toHaveBeenCalled();
  });

  it("maps an Auth.js CredentialsSignin failure to the generic error (AC-AUTH-004)", async () => {
    signInMock.mockRejectedValue(new AuthError("CredentialsSignin"));
    const state = await loginAction(
      null,
      makeForm({ email: "user@example.com", password: "wrong-password" })
    );
    expect(state).toEqual({ error: INVALID_CREDENTIALS_MESSAGE });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("performs no credential verification of its own (no bcrypt/hash lookups)", async () => {
    // signIn is the only auth mechanism invoked; a non-AuthError failure
    // propagates untouched (never transformed into a credential message).
    signInMock.mockRejectedValue(new Error("infra down"));
    await expect(
      loginAction(null, makeForm({ email: "user@example.com", password: "password" }))
    ).rejects.toThrow("infra down");
  });
});

// -- registerAction ------------------------------------------------------

describe("registerAction", () => {
  beforeEach(() => {
    signInMock.mockReset();
    registerUserMock.mockReset();
    redirectMock.mockReset();
    redirectMock.mockImplementation((url: string) => {
      throw new RedirectSignal(url);
    });
  });

  it("creates the account via the service, authenticates through Auth.js, redirects to /dashboard (AC-AUTH-001)", async () => {
    registerUserMock.mockResolvedValue({
      ok: true,
      user: { id: "u1", email: "user@example.com" },
    } satisfies RegistrationResult);
    signInMock.mockResolvedValue(undefined);

    await expect(
      registerAction(null, makeForm({ email: "  User@Example.com ", password: "password-123" }))
    ).rejects.toThrow(RedirectSignal);

    expect(registerUserMock).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password-123",
    });
    // The same single Auth.js signIn path as login is used.
    expect(signInMock).toHaveBeenCalledWith("credentials", {
      email: "user@example.com",
      password: "password-123",
      redirect: false,
    });
    expectRedirect("/dashboard");
  });

  it("returns the safe duplicate error and never authenticates (AC-AUTH-002)", async () => {
    registerUserMock.mockResolvedValue({ ok: false, code: "duplicate" });
    const state = await registerAction(
      null,
      makeForm({ email: "taken@example.com", password: "password-123" })
    );
    expect(state).toEqual({ error: DUPLICATE_ACCOUNT_MESSAGE });
    expect(signInMock).not.toHaveBeenCalled();
  });

  it("returns field errors for weak passwords without calling the service", async () => {
    const state = await registerAction(
      null,
      makeForm({ email: "user@example.com", password: "short" })
    );
    expect(state?.error).toBeTruthy();
    expect(state?.fieldErrors?.password).toBeTruthy();
    expect(registerUserMock).not.toHaveBeenCalled();
  });

  it("returns a generic error if authentication after registration fails", async () => {
    registerUserMock.mockResolvedValue({
      ok: true,
      user: { id: "u1", email: "user@example.com" },
    });
    signInMock.mockRejectedValue(new AuthError("boom"));
    const state = await registerAction(
      null,
      makeForm({ email: "user@example.com", password: "password-123" })
    );
    expect(state).toEqual({ error: GENERIC_ERROR_MESSAGE });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("normalizes credentials before delegating", async () => {
    registerUserMock.mockResolvedValue({
      ok: true,
      user: { id: "u1", email: "user@example.com" },
    });
    signInMock.mockResolvedValue(undefined);
    await expect(
      registerAction(
        null,
        makeForm({ email: "USER@EXAMPLE.COM", password: "password-123" })
      )
    ).rejects.toThrow(RedirectSignal);
    expect(signInMock).toHaveBeenCalledWith("credentials", {
      email: "user@example.com",
      password: "password-123",
      redirect: false,
    });
  });
});

// -- logoutAction --------------------------------------------------------

describe("logoutAction", () => {
  beforeEach(() => {
    signOutMock.mockReset();
    redirectMock.mockReset();
    redirectMock.mockImplementation((url: string) => {
      throw new RedirectSignal(url);
    });
  });

  it("terminates the session via Auth.js signOut and redirects to /login (AC-AUTH-006)", async () => {
    signOutMock.mockResolvedValue(undefined);
    await expect(logoutAction()).rejects.toThrow(RedirectSignal);
    expect(signOutMock).toHaveBeenCalledWith({ redirect: false });
    expectRedirect("/login");
  });
});
