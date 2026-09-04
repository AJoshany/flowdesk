import { describe, expect, it } from "vitest";
import { activityFieldsSchema } from "./schemas";

describe("activity field validation", () => {
  it("accepts a valid note with no associations (workspace-level activity)", () => {
    const result = activityFieldsSchema.safeParse({
      note: "Followed up on the renewal.",
      customerId: null,
      dealId: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.note).toBe("Followed up on the renewal.");
    }
  });

  it("requires a note", () => {
    for (const note of [undefined, "", "   "]) {
      const result = activityFieldsSchema.safeParse({
        note,
        customerId: null,
        dealId: null,
      });
      expect(result.success).toBe(false);
    }
  });

  it("rejects notes longer than 2000 characters", () => {
    const result = activityFieldsSchema.safeParse({
      note: "x".repeat(2001),
      customerId: null,
      dealId: null,
    });
    expect(result.success).toBe(false);
  });

  it("trims notes", () => {
    const result = activityFieldsSchema.safeParse({
      note: "  Called Acme  ",
      customerId: null,
      dealId: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.note).toBe("Called Acme");
    }
  });
});

describe("association validation (BR-ACT-002/003/004)", () => {
  it("accepts a customer-only, deal-only, and both associations", () => {
    const customerOnly = activityFieldsSchema.safeParse({
      note: "Note",
      customerId: "cm1a2b3c4d5e6f7g8h9i0j1k2",
      dealId: null,
    });
    expect(customerOnly.success).toBe(true);

    const dealOnly = activityFieldsSchema.safeParse({
      note: "Note",
      customerId: null,
      dealId: "dl1a2b3c4d5e6f7g8h9i0j1k2",
    });
    expect(dealOnly.success).toBe(true);

    const both = activityFieldsSchema.safeParse({
      note: "Note",
      customerId: "cm1a2b3c4d5e6f7g8h9i0j1k2",
      dealId: "dl1a2b3c4d5e6f7g8h9i0j1k2",
    });
    expect(both.success).toBe(true);
  });

  it("treats missing/empty association ids as no association", () => {
    for (const field of ["customerId", "dealId"]) {
      for (const value of [undefined, "", "   ", null]) {
        const result = activityFieldsSchema.safeParse({
          note: "Note",
          customerId: null,
          dealId: null,
          [field]: value,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data[field]).toBeNull();
        }
      }
    }
  });

  it("rejects malformed association ids", () => {
    for (const field of ["customerId", "dealId"]) {
      for (const value of ["bad id !!", "has space", "x".repeat(65)]) {
        const result = activityFieldsSchema.safeParse({
          note: "Note",
          customerId: null,
          dealId: null,
          [field]: value,
        });
        expect(result.success).toBe(false);
      }
    }
  });
});
