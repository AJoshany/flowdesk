import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { registerUser } from "@/features/auth/services";
import { createCustomer, deleteCustomer } from "@/features/customers/service";
import { createDeal, deleteDeal } from "@/features/deals/service";
import { uniqueEmail } from "../../../tests/helpers/env";
import {
  createActivity,
  listActivities,
  listActivitiesForCustomer,
  listActivitiesForDeal,
  listRecentActivities,
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
    email: uniqueEmail("act-cust"),
    phone: null,
    company: null,
  });
  if (!result.ok) throw new Error("seed customer failed");
  return result.value;
}

async function seedDeal(workspaceId: string, customerId: string | null = null) {
  const result = await createDeal(workspaceId, {
    title: "Seed deal",
    stage: "NEW",
    customerId,
  });
  if (!result.ok) throw new Error("seed deal failed");
  return result.value;
}

async function seedActivity(
  workspaceId: string,
  overrides: Record<string, unknown> = {}
) {
  const result = await createActivity(workspaceId, {
    note: "Seed activity",
    customerId: null,
    dealId: null,
    ...overrides,
  });
  if (!result.ok) throw new Error("seed activity failed");
  return result.value;
}

describe("activity service (integration, test database)", () => {
  it("creates an activity under the given workspace (AC-ACT-001, BR-ACT-001)", async () => {
    const { workspaceId } = await registerOwner("act-create");
    const activity = await seedActivity(workspaceId, {
      note: "Initial discovery call",
    });

    const row = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(row?.workspaceId).toBe(workspaceId);
    expect(row?.note).toBe("Initial discovery call");
    expect(row?.customerId).toBeNull();
    expect(row?.dealId).toBeNull();
  });

  it("associates an activity with a customer, a deal, or both (BR-ACT-002/003/004)", async () => {
    const { workspaceId } = await registerOwner("act-assoc");
    const customer = await seedCustomer(workspaceId);
    const deal = await seedDeal(workspaceId, customer.id);

    const withCustomer = await seedActivity(workspaceId, { customerId: customer.id });
    const withDeal = await seedActivity(workspaceId, { dealId: deal.id });
    const withBoth = await seedActivity(workspaceId, {
      customerId: customer.id,
      dealId: deal.id,
    });

    expect(withCustomer.customer?.name).toBe("Acme Inc");
    expect(withDeal.deal?.title).toBe("Seed deal");
    const bothRow = await prisma.activity.findUniqueOrThrow({
      where: { id: withBoth.id },
    });
    expect(bothRow.customerId).toBe(customer.id);
    expect(bothRow.dealId).toBe(deal.id);
  });

  it("rejects an activity referencing another workspace's customer (BR-ACT-005)", async () => {
    const a = await registerOwner("act-xcust-a");
    const b = await registerOwner("act-xcust-b");
    const customerB = await seedCustomer(b.workspaceId);

    const result = await createActivity(a.workspaceId, {
      note: "Cross-workspace attempt",
      customerId: customerB.id,
      dealId: null,
    });
    expect(result).toEqual({ ok: false, code: "invalid_reference" });
    const count = await prisma.activity.count({ where: { workspaceId: a.workspaceId } });
    expect(count).toBe(0);
  });

  it("rejects an activity referencing another workspace's deal", async () => {
    const a = await registerOwner("act-xdeal-a");
    const b = await registerOwner("act-xdeal-b");
    const dealB = await seedDeal(b.workspaceId);

    const result = await createActivity(a.workspaceId, {
      note: "Cross-workspace attempt",
      customerId: null,
      dealId: dealB.id,
    });
    expect(result).toEqual({ ok: false, code: "invalid_reference" });
    const count = await prisma.activity.count({ where: { workspaceId: a.workspaceId } });
    expect(count).toBe(0);
  });

  it("rejects unknown customer/deal ids", async () => {
    const { workspaceId } = await registerOwner("act-unknown");
    const badCustomer = await createActivity(workspaceId, {
      note: "Ghost customer",
      customerId: "doesnotexist",
      dealId: null,
    });
    expect(badCustomer).toEqual({ ok: false, code: "invalid_reference" });

    const badDeal = await createActivity(workspaceId, {
      note: "Ghost deal",
      customerId: null,
      dealId: "doesnotexist",
    });
    expect(badDeal).toEqual({ ok: false, code: "invalid_reference" });
  });

  it("rejects invalid input (blank note)", async () => {
    const { workspaceId } = await registerOwner("act-invalid");
    const result = await createActivity(workspaceId, {
      note: "",
      customerId: null,
      dealId: null,
    });
    expect(result).toEqual({ ok: false, code: "invalid_input" });
  });

  it("lists only the workspace's activities, newest first (AC-ACT-004)", async () => {
    const a = await registerOwner("act-list-a");
    const b = await registerOwner("act-list-b");

    const actA = await seedActivity(a.workspaceId, { note: "A's activity" });
    await seedActivity(b.workspaceId, { note: "B's activity" });

    const feedA = await listActivities(a.workspaceId);
    expect(feedA.map((x) => x.id)).toContain(actA.id);
    expect(feedA.every((x) => x.workspaceId === a.workspaceId)).toBe(true);
    expect(feedA.some((x) => x.note === "B's activity")).toBe(false);

    // Newest first.
    const newer = await seedActivity(a.workspaceId, { note: "A's newer" });
    const feedAgain = await listActivities(a.workspaceId);
    expect(feedAgain[0].id).toBe(newer.id);
  });

  it("returns an empty feed for a workspace with no activities", async () => {
    const { workspaceId } = await registerOwner("act-empty");
    await expect(listActivities(workspaceId)).resolves.toEqual([]);
  });

  it("limits recent activities and returns the newest first (REQ-DASH-004)", async () => {
    const { workspaceId } = await registerOwner("act-recent");

    for (let i = 0; i < 6; i++) {
      await seedActivity(workspaceId, { note: `Activity ${i}` });
    }
    const newest = await seedActivity(workspaceId, { note: "Newest activity" });

    const recent = await listRecentActivities(workspaceId, 3);
    expect(recent).toHaveLength(3);
    expect(recent[0].id).toBe(newest.id);
    expect(recent.map((x) => x.workspaceId).every((id) => id === workspaceId)).toBe(true);
    const timestamps = recent.map((x) => x.createdAt.getTime());
    expect([...timestamps].sort((a, b) => b - a)).toEqual(timestamps);
  });

  it("scopes recent activities to the workspace (BR-ACT-005)", async () => {
    const a = await registerOwner("act-recent-a");
    const b = await registerOwner("act-recent-b");

    await seedActivity(a.workspaceId, { note: "A's activity" });
    await seedActivity(b.workspaceId, { note: "B's activity" });

    const recentA = await listRecentActivities(a.workspaceId, 5);
    expect(recentA.map((x) => x.note)).toEqual(["A's activity"]);
  });

  it("scopes customer activity history to that customer (AC-ACT-002)", async () => {
    const { workspaceId } = await registerOwner("act-custhist");
    const customerA = await seedCustomer(workspaceId);
    const customerOther = await seedCustomer(workspaceId);

    const forA = await seedActivity(workspaceId, { customerId: customerA.id });
    await seedActivity(workspaceId, { customerId: customerOther.id });
    await seedActivity(workspaceId, { note: "Workspace-level in A" });

    // Only activities linked to customerA come back, newest first.
    const history = await listActivitiesForCustomer(workspaceId, customerA.id);
    expect(history.map((x) => x.id)).toEqual([forA.id]);
    expect(history.every((x) => x.customerId === customerA.id)).toBe(true);
  });

  it("scopes deal activity history to the deal's workspace (AC-ACT-003)", async () => {
    const a = await registerOwner("act-dealhist-a");
    const b = await registerOwner("act-dealhist-b");
    const dealA = await seedDeal(a.workspaceId);
    await seedDeal(b.workspaceId);

    const forA = await seedActivity(a.workspaceId, { dealId: dealA.id });
    await seedActivity(a.workspaceId, { note: "Workspace-level in A" });

    const history = await listActivitiesForDeal(a.workspaceId, dealA.id);
    expect(history.map((x) => x.id)).toEqual([forA.id]);
    expect(history.every((x) => x.dealId === dealA.id)).toBe(true);
  });

  it("returns an empty history for a foreign or unknown customer/deal id (no disclosure)", async () => {
    const a = await registerOwner("act-scope-a");
    const b = await registerOwner("act-scope-b");
    const customerA = await seedCustomer(a.workspaceId);
    const dealA = await seedDeal(a.workspaceId);
    await seedActivity(a.workspaceId, { customerId: customerA.id });
    await seedActivity(a.workspaceId, { dealId: dealA.id });

    // Same ids asked from workspace B → no activities (resource invisible).
    await expect(listActivitiesForCustomer(b.workspaceId, customerA.id)).resolves.toEqual([]);
    await expect(listActivitiesForDeal(b.workspaceId, dealA.id)).resolves.toEqual([]);
    await expect(listActivitiesForCustomer(a.workspaceId, "doesnotexist")).resolves.toEqual([]);
    await expect(listActivitiesForDeal(a.workspaceId, "doesnotexist")).resolves.toEqual([]);
  });

  it("keeps activity history when the referenced customer is deleted (SetNull)", async () => {
    const { workspaceId } = await registerOwner("act-custdel");
    const customer = await seedCustomer(workspaceId);
    const activity = await seedActivity(workspaceId, { customerId: customer.id });

    const removal = await deleteCustomer(workspaceId, customer.id);
    expect(removal).toEqual({ ok: true, value: null });

    const row = await prisma.activity.findUniqueOrThrow({ where: { id: activity.id } });
    expect(row).not.toBeNull();
    expect(row.customerId).toBeNull();
  });

  it("keeps activity history when the referenced deal is deleted (SetNull)", async () => {
    const { workspaceId } = await registerOwner("act-dealdel");
    const deal = await seedDeal(workspaceId);
    const activity = await seedActivity(workspaceId, { dealId: deal.id });

    const removal = await deleteDeal(workspaceId, deal.id);
    expect(removal).toEqual({ ok: true, value: null });

    const row = await prisma.activity.findUniqueOrThrow({ where: { id: activity.id } });
    expect(row).not.toBeNull();
    expect(row.dealId).toBeNull();
  });
});
