import { describe, expect, it } from "vitest";
import {
  changeRoleSchema,
  inviteMemberSchema,
  membershipIdSchema,
} from "./schemas";

describe("invite member schema", () => {
  it("accepts a valid email and role", () => {
    const result = inviteMemberSchema.safeParse({
      email: "newbie@example.com",
      role: "MEMBER",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ email: "newbie@example.com", role: "MEMBER" });
    }
  });

  it("accepts every supported role (BR-TEAM-003)", () => {
    for (const role of ["OWNER", "MANAGER", "MEMBER"]) {
      const result = inviteMemberSchema.safeParse({
        email: "newbie@example.com",
        role,
      });
      expect(result.success).toBe(true);
    }
  });

  it("normalizes the email (trim + lowercase)", () => {
    const result = inviteMemberSchema.safeParse({
      email: "  New@Example.COM ",
      role: "MEMBER",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("new@example.com");
    }
  });

  it("rejects an invalid email", () => {
    const result = inviteMemberSchema.safeParse({
      email: "not-an-email",
      role: "MEMBER",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.email).toBeTruthy();
    }
  });

  it("rejects an unsupported role value", () => {
    const result = inviteMemberSchema.safeParse({
      email: "newbie@example.com",
      role: "ADMIN",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.role).toBeTruthy();
    }
  });

  it("rejects missing required fields", () => {
    expect(inviteMemberSchema.safeParse({ email: "newbie@example.com" }).success).toBe(false);
    expect(inviteMemberSchema.safeParse({ role: "MEMBER" }).success).toBe(false);
  });
});

describe("change role schema", () => {
  it("accepts a valid membership id and role", () => {
    const result = changeRoleSchema.safeParse({
      membershipId: "cm1a2b3c4d5e6f7g8h9i0j1k2",
      role: "MANAGER",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unsupported role", () => {
    const result = changeRoleSchema.safeParse({
      membershipId: "cm1a2b3c4d5e6f7g8h9i0j1k2",
      role: "SUPERUSER",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.role).toBeTruthy();
    }
  });

  it("rejects empty and malformed membership ids", () => {
    const empty = changeRoleSchema.safeParse({ membershipId: "", role: "MANAGER" });
    expect(empty.success).toBe(false);

    const malformed = changeRoleSchema.safeParse({
      membershipId: "id with spaces!!",
      role: "MANAGER",
    });
    expect(malformed.success).toBe(false);
    if (!malformed.success) {
      expect(malformed.error.flatten().fieldErrors.membershipId).toBeTruthy();
    }
  });
});

describe("membership id schema", () => {
  it("accepts a cuid-like id", () => {
    expect(membershipIdSchema.safeParse("cm1a2b3c4d5e6f7g8h9i0j1k2").success).toBe(true);
  });

  it("rejects empty, over-length and malformed ids", () => {
    expect(membershipIdSchema.safeParse("").success).toBe(false);
    expect(membershipIdSchema.safeParse("x".repeat(65)).success).toBe(false);
    expect(membershipIdSchema.safeParse("bad id!!").success).toBe(false);
  });
});