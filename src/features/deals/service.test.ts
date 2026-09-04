import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { registerUser } from "@/features/auth/services";
import { createCustomer, deleteCustomer } from "@/features/customers/service";
import { uniqueEmail } from "../../../tests/helpers/env";
import {
  createDeal,
  deleteDeal,
  getDealById,
  listDeals,
  updateDeal,
} from "./service";

const PASSWORD = "password-123";

async function registerOwner(prefix: string): Promise<{
  userId: string;
  workspaceId: string;
}> {
  const email = uniqueEmail(prefix);
  const result = await registerUser({ email, password: PASSWORD });
  if (!result.ok) throw new Error(`seed failed for ${prefix}`);
  const membership = await prisma.membership.findFirstOrThrow({
    where: { userId: result.user.id },
    select: { workspaceId: true },
  });
  return { userId: result.user.id, workspaceId: membership.workspaceId };
}

async function seedCustomer(workspaceId: string) {
  const result = await createCustomer(workspaceId, {
    name: "Acme Inc",
    email: uniqueEmail("deal-cust"),
    phone: null,
    company: null,
  });
  if (!result.ok) throw new Error("seed customer failed");
  return result.value;
}

async function seedDeal(workspaceId: string, overrides: Record<string, unknown> = {}) {
  const result = await createDeal(workspaceId, {
    title: "Seed deal",
    stage: "NEW",
    customerId: null,
    ...overrides,
  });
  if (!result.ok) throw new Error("seed deal failed");
  return result.value;
}

describe("deal service (integration, test database)", () => {
  it("creates a deal under the given workspace with a default stage (AC-DEAL-002, BR-DEAL-001/003)", async () => {
    const { workspaceId } = await registerOwner("deal-create");
    const deal = await seedDeal(workspaceId, { title: "Fresh opportunity" });

    const row = await prisma.deal.findUnique({ where: { id: deal.id } });
    expect(row?.workspaceId).toBe(workspaceId);
    expect(row?.title).toBe("Fresh opportunity");
    // Stage defaulted to NEW when omitted (BR-DEAL-003).
    expect(row?.stage).toBe("NEW");
    expect(row?.customerId).toBeNull();
  });

  it("creates a deal associated with a customer of the same workspace", async () => {
    const { workspaceId } = await registerOwner("deal-assoc");
    const customer = await seedCustomer(workspaceId);
    const deal = await seedDeal(workspaceId, { customerId: customer.id });

    const row = await prisma.deal.findUniqueOrThrow({ where: { id: deal.id } });
    expect(row.customerId).toBe(customer.id);
    expect(deal.customer?.name).toBe("Acme Inc");
  });

  it("rejects a deal referencing a customer of another workspace (BR-DEAL-006, invalid customer reference)", async () => {
    const a = await registerOwner("deal-xcust-a");
    const b = await registerOwner("deal-xcust-b");
    const customerB = await seedCustomer(b.workspaceId);

    const result = await createDeal(a.workspaceId, {
      title: "Cross-workspace attempt",
      stage: "NEW",
      customerId: customerB.id,
    });
    expect(result).toEqual({ ok: false, code: "invalid_customer" });

    // Nothing was created.
    const count = await prisma.deal.count({ where: { workspaceId: a.workspaceId } });
    expect(count).toBe(0);
  });

  it("rejects a deal referencing an unknown customer id", async () => {
    const { workspaceId } = await registerOwner("deal-nocust");
    const result = await createDeal(workspaceId, {
      title: "Ghost customer",
      stage: "NEW",
      customerId: "doesnotexist",
    });
    expect(result).toEqual({ ok: false, code: "invalid_customer" });
  });

  it("rejects invalid input (missing title, invalid stage)", async () => {
    const { workspaceId } = await registerOwner("deal-invalid");
    const noTitle = await createDeal(workspaceId, {
      title: "",
      stage: "NEW",
      customerId: null,
    });
    expect(noTitle).toEqual({ ok: false, code: "invalid_input" });

    // "CLOSED" is not a defined stage — rejected at runtime by Zod even
    // though the compile-time type is narrower.
    const badStage = await createDeal(
      workspaceId,
      {
        title: "Valid title",
        stage: "CLOSED",
        customerId: null,
      } as unknown as Parameters<typeof createDeal>[1]
    );
    expect(badStage).toEqual({ ok: false, code: "invalid_input" });
  });

  it("lists only deals of the workspace, newest first (AC-DEAL-001)", async () => {
    const a = await registerOwner("deal-list-a");
    const b = await registerOwner("deal-list-b");

    const dealA = await seedDeal(a.workspaceId, { title: "A's deal" });
    await seedDeal(b.workspaceId, { title: "B's deal" });

    const listA = await listDeals(a.workspaceId);
    expect(listA.map((d) => d.id)).toContain(dealA.id);
    expect(listA.every((d) => d.workspaceId === a.workspaceId)).toBe(true);
    expect(listA.some((d) => d.title === "B's deal")).toBe(false);

    // Newest first.
    const newer = await seedDeal(a.workspaceId, { title: "A's newer deal" });
    const listAgain = await listDeals(a.workspaceId);
    expect(listAgain[0].id).toBe(newer.id);
  });

  it("returns an empty list for a workspace with no deals", async () => {
    const { workspaceId } = await registerOwner("deal-empty");
    await expect(listDeals(workspaceId)).resolves.toEqual([]);
  });

  it("resolves a deal only inside its own workspace (BR-DEAL-006)", async () => {
    const a = await registerOwner("deal-scope-a");
    const b = await registerOwner("deal-scope-b");
    const deal = await seedDeal(a.workspaceId);

    await expect(getDealById(a.workspaceId, deal.id)).resolves.toMatchObject({
      id: deal.id,
    });
    // Same id from another workspace → null (missing/foreign indistinguishable).
    await expect(getDealById(b.workspaceId, deal.id)).resolves.toBeNull();
    await expect(getDealById(a.workspaceId, "not-a-real-id")).resolves.toBeNull();
  });

  it("persists stage changes and detects concurrent updates (AC-DEAL-003)", async () => {
    const { workspaceId } = await registerOwner("deal-update");
    const deal = await seedDeal(workspaceId, { title: "Pipeline deal" });

    // Stale expectedUpdatedAt → conflict, nothing written.
    const stale = new Date(deal.updatedAt.getTime() - 60_000);
    const conflict = await updateDeal(
      workspaceId,
      deal.id,
      { title: "Renamed", stage: "PROPOSAL", customerId: null },
      stale
    );
    expect(conflict).toEqual({ ok: false, code: "conflict" });

    // Correct timestamp → stage change persisted (AC-DEAL-003).
    const updated = await updateDeal(
      workspaceId,
      deal.id,
      { title: "Pipeline deal v2", stage: "PROPOSAL", customerId: null },
      deal.updatedAt
    );
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.value.stage).toBe("PROPOSAL");
      expect(updated.value.title).toBe("Pipeline deal v2");
    }
    const row = await prisma.deal.findUniqueOrThrow({ where: { id: deal.id } });
    expect(row.stage).toBe("PROPOSAL");
  });

  it("cannot update a deal from another workspace (cross-workspace update rejected)", async () => {
    const a = await registerOwner("deal-xupd-a");
    const b = await registerOwner("deal-xupd-b");
    const deal = await seedDeal(a.workspaceId);

    const result = await updateDeal(
      b.workspaceId,
      deal.id,
      { title: "Hijacked", stage: "WON", customerId: null },
      deal.updatedAt
    );
    expect(result).toEqual({ ok: false, code: "not_found" });

    const row = await prisma.deal.findUniqueOrThrow({ where: { id: deal.id } });
    expect(row.title).not.toBe("Hijacked");
  });

  it("rejects moving a deal to a customer of another workspace on update", async () => {
    const a = await registerOwner("deal-xcust-upd-a");
    const b = await registerOwner("deal-xcust-upd-b");
    const customerB = await seedCustomer(b.workspaceId);
    const deal = await seedDeal(a.workspaceId);

    const result = await updateDeal(
      a.workspaceId,
      deal.id,
      { title: deal.title, stage: deal.stage, customerId: customerB.id },
      deal.updatedAt
    );
    expect(result).toEqual({ ok: false, code: "invalid_customer" });

    const row = await prisma.deal.findUniqueOrThrow({ where: { id: deal.id } });
    expect(row.customerId).toBeNull();
  });

  it("deletes a deal and rejects cross-workspace deletion (AC-DEAL-004/006)", async () => {
    const a = await registerOwner("deal-del-a");
    const b = await registerOwner("deal-del-b");
    const deal = await seedDeal(a.workspaceId);

    // B cannot delete A's deal.
    const foreign = await deleteDeal(b.workspaceId, deal.id);
    expect(foreign).toEqual({ ok: false, code: "not_found" });
    await expect(
      prisma.deal.findUnique({ where: { id: deal.id } })
    ).resolves.not.toBeNull();

    // A can delete it.
    const own = await deleteDeal(a.workspaceId, deal.id);
    expect(own).toEqual({ ok: true, value: null });
    await expect(
      prisma.deal.findUnique({ where: { id: deal.id } })
    ).resolves.toBeNull();
  });

  it("reports not_found when deleting a missing deal", async () => {
    const { workspaceId } = await registerOwner("deal-del-missing");
    await expect(deleteDeal(workspaceId, "missing-id")).resolves.toEqual({
      ok: false,
      code: "not_found",
    });
  });

  it("unlinks a deal when its customer is deleted instead of deleting the deal", async () => {
    const { workspaceId } = await registerOwner("deal-custdel");
    const customer = await seedCustomer(workspaceId);
    const deal = await seedDeal(workspaceId, { customerId: customer.id });

    const removal = await deleteCustomer(workspaceId, customer.id);
    expect(removal).toEqual({ ok: true, value: null });

    const row = await prisma.deal.findUniqueOrThrow({ where: { id: deal.id } });
    expect(row).not.toBeNull();
    expect(row.customerId).toBeNull();
  });
});
