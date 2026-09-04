import { describe, expect, it } from "vitest";
import {
  createCustomerSchema,
  customerIdSchema,
  expectedUpdatedAtSchema,
} from "./schemas";

describe("customer fields schema", () => {
  it("accepts a valid customer", () => {
    const result = createCustomerSchema.safeParse({
      name: "Acme Inc",
      email: "billing@acme.example",
      phone: "+1 555 0100",
      company: "Acme",
    });
    expect(result.success).toBe(true);
  });

  it("accepts missing optional fields", () => {
    const result = createCustomerSchema.safeParse({
      name: "Acme Inc",
      email: "billing@acme.example",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBeNull();
      expect(result.data.company).toBeNull();
    }
  });

  it("normalizes empty optional fields to null", () => {
    const result = createCustomerSchema.safeParse({
      name: "Acme Inc",
      email: "billing@acme.example",
      phone: "",
      company: "   ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBeNull();
      expect(result.data.company).toBeNull();
    }
  });

  it("rejects an empty/whitespace name", () => {
    const result = createCustomerSchema.safeParse({
      name: "   ",
      email: "billing@acme.example",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toBeTruthy();
    }
  });

  it("rejects an invalid email", () => {
    const result = createCustomerSchema.safeParse({
      name: "Acme Inc",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.email).toBeTruthy();
    }
  });

  it("normalizes the email (trim + lowercase)", () => {
    const result = createCustomerSchema.safeParse({
      name: "Acme Inc",
      email: "  Billing@Acme.Example ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("billing@acme.example");
    }
  });

  it("rejects over-length fields", () => {
    const result = createCustomerSchema.safeParse({
      name: "x".repeat(201),
      email: "billing@acme.example",
      company: "y".repeat(201),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toBeTruthy();
      expect(result.error.flatten().fieldErrors.company).toBeTruthy();
    }
  });
});

describe("customer id schema", () => {
  it("accepts a cuid-like id", () => {
    expect(customerIdSchema.safeParse("cm1a2b3c4d5e6f7g8h9i0j1k2").success).toBe(true);
  });

  it("rejects empty, over-length and malformed ids", () => {
    expect(customerIdSchema.safeParse("").success).toBe(false);
    expect(customerIdSchema.safeParse("x".repeat(65)).success).toBe(false);
    expect(customerIdSchema.safeParse("id with spaces!!").success).toBe(false);
  });
});

describe("expectedUpdatedAt schema", () => {
  it("accepts an ISO timestamp", () => {
    const result = expectedUpdatedAtSchema.safeParse(new Date().toISOString());
    expect(result.success).toBe(true);
  });

  it("rejects a non-date", () => {
    expect(expectedUpdatedAtSchema.safeParse("not-a-date").success).toBe(false);
  });
});