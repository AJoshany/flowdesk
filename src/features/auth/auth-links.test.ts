import { test, expect } from "vitest";
import { setupAuthErrorLink } from "./links";
import { AUTH_SETTINGS_LINK } from "./messages";

function withEnv(overrides: Record<string, string | undefined>, fn: () => void) {
  const before = {
    AUTH_SECRET: process.env.AUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  };
  try {
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    fn();
  } finally {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("login link helper returns configuration instructions when auth is missing", () => {
  withEnv(
    { AUTH_SECRET: "", NEXTAUTH_URL: "" },
    () => {
      expect(
        setupAuthErrorLink({ actionName: "login", destination: "/dashboard" })
      ).toContain("AUTH_SECRET");
      expect(
        setupAuthErrorLink({ actionName: "login", destination: "/dashboard" })
      ).toContain(AUTH_SETTINGS_LINK);
    }
  );
});

test("register link helper returns configuration instructions when auth is missing", () => {
  withEnv(
    { AUTH_SECRET: undefined, NEXTAUTH_URL: undefined },
    () => {
      expect(
        setupAuthErrorLink({ actionName: "register", destination: "/dashboard" })
      ).toContain("NEXTAUTH_URL");
    }
  );
});

test("link helper returns a configuration message when only NEXTAUTH_URL is missing", () => {
  withEnv(
    { AUTH_SECRET: "set", NEXTAUTH_URL: "" },
    () => {
      expect(
        setupAuthErrorLink({ actionName: "register", destination: "/dashboard" })
      ).toContain("NEXTAUTH_URL");
    }
  );
});

test("link helper is silent when auth environment looks configured", () => {
  withEnv(
    { AUTH_SECRET: "not-empty", NEXTAUTH_URL: "https://example.test" },
    () => {
      expect(
        setupAuthErrorLink({ actionName: "login", destination: "/dashboard" })
      ).toBeNull();
    }
  );
});
