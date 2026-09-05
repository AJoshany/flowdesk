import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "./schemas";

describe("registerSchema", () => {
  it("accepts a valid email and a password of at least 8 characters", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "correct-horse",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = registerSchema.safeParse({
      email: "not-an-email",
      password: "correct-horse",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.email).toBeTruthy();
    }
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "short",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.password).toBeTruthy();
    }
  });

  it("rejects a missing password", () => {
    const result = registerSchema.safeParse({ email: "user@example.com" });
    expect(result.success).toBe(false);
  });

  it("normalizes the email (trims and lowercases)", () => {
    const result = registerSchema.safeParse({
      email: "  User@Example.COM ",
      password: "correct-horse",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
    }
  });
});

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "any-password",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email format", () => {
    expect(
      loginSchema.safeParse({ email: "nope", password: "x" }).success
    ).toBe(false);
  });

  it("rejects a missing password", () => {
    expect(
      loginSchema.safeParse({ email: "user@example.com" }).success
    ).toBe(false);
  });

  it("normalizes the email (trims and lowercases)", () => {
    const result = loginSchema.safeParse({
      email: "  User@Example.COM ",
      password: "x",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
    }
  });
});
