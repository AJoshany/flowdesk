import { describe, expect, it } from "vitest";
import {
  createDealSchema,
  dealFieldsSchema,
  dealIdSchema,
  expectedUpdatedAtSchema,
  updateDealSchema,
} from "./schemas";

const validFields = {
  title: "Enterprise onboarding",
  stage: "NEW",
  customerId: null,
} as const;

describe("deal field validation", () => {
  it("accepts valid fields", () => {
    expect(dealFieldsSchema.safeParse(validFields).success).toBe(true);
  });

  it("requires a title", () => {
    for (const title of [undefined, "", "   "]) {
      const result = dealFieldsSchema.safeParse({ ...validFields, title });
      expect(result.success).toBe(false);
    }
  });

  it("rejects titles longer than 200 characters", () => {
    const result = dealFieldsSchema.safeParse({
      ...validFields,
      title: "x".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("trims titles", () => {
    const result = dealFieldsSchema.safeParse({
      ...validFields,
      title: "  Onboarding  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Onboarding");
    }
  });
});

describe("pipeline stage validation", () => {
  it("accepts every defined stage", () => {
    for (const stage of ["NEW", "QUALIFIED", "PROPOSAL", "WON", "LOST"]) {
      expect(
        dealFieldsSchema.safeParse({ ...validFields, stage }).success
      ).toBe(true);
    }
  });

  it("rejects an invalid or empty stage", () => {
    for (const stage of ["BOGUS", "", "new", "CLOSED_WON", undefined]) {
      const result = dealFieldsSchema.safeParse({ ...validFields, stage });
      expect(result.success).toBe(false);
    }
  });

  it("defaults the stage to NEW on create (BR-DEAL-003)", () => {
    const { title, customerId } = validFields;
    const result = createDealSchema.safeParse({ title, customerId });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stage).toBe("NEW");
    }
  });

  it("requires an explicit stage on update (never silently resets)", () => {
    const result = updateDealSchema.safeParse({
      title: validFields.title,
      customerId: null,
    });
    expect(result.success).toBe(false);
  });
});

describe("customer association validation", () => {
  it("treats missing/empty customer id as no association", () => {
    for (const customerId of [undefined, "", "   ", null]) {
      const result = dealFieldsSchema.safeParse({ ...validFields, customerId });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.customerId).toBeNull();
      }
    }
  });

  it("accepts a well-formed customer id", () => {
    const result = dealFieldsSchema.safeParse({
      ...validFields,
      customerId: "cm1a2b3c4d5e6f7g8h9i0j1k2",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customerId).toBe("cm1a2b3c4d5e6f7g8h9i0j1k2");
    }
  });

  it("rejects malformed customer ids", () => {
    for (const customerId of ["bad id !!", "has space", "x".repeat(65)]) {
      const result = dealFieldsSchema.safeParse({ ...validFields, customerId });
      expect(result.success).toBe(false);
    }
  });
});

describe("deal id and concurrency timestamp validation", () => {
  it("accepts a well-formed deal id and rejects malformed ones", () => {
    expect(dealIdSchema.safeParse("dl1a2b3c4d5e6f7g8h9i0j1k2").success).toBe(
      true
    );
    for (const id of ["", "bad id !!", "x".repeat(65)]) {
      expect(dealIdSchema.safeParse(id).success).toBe(false);
    }
  });

  it("parses an ISO timestamp and rejects garbage", () => {
    expect(expectedUpdatedAtSchema.safeParse("2026-09-04T10:00:00.000Z").success).toBe(
      true
    );
    expect(expectedUpdatedAtSchema.safeParse("not-a-date").success).toBe(false);
  });
});
