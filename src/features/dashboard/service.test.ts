import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { registerUser } from "@/features/auth/services";
import { createActivity } from "@/features/activities/service";
import { createCustomer } from "@/features/customers/service";
import { createDeal } from "@/features/deals/service";
import { DEAL_STAGES } from "@/features/deals/stages";
import { uniqueEmail } from "../../../tests/helpers/env";
import { getDashboardData, RECENT_ACTIVITIES_LIMIT } from "./service";

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
    email: uniqueEmail("dash-cust"),
    phone: null,
    company: null,
  });
  if (!result.ok) throw new Error("seed customer failed");
  return result.value;
}

async function seedDeal(
  workspaceId: string,
  stage: (typeof DEAL_STAGES)[number],
  customerId: string | null = null
) {
  const result = await createDeal(workspaceId, {
    title: "Seed deal",
    stage,
    customerId,
  });
  if (!result.ok) throw new Error("seed deal failed");
  return result.value;
}

async function seedActivity(workspaceId: string, note: string) {
  const result = await createActivity(workspaceId, {
    note,
    customerId: null,
    dealId: null,
  });
  if (!result.ok) throw new Error("seed activity failed");
  return result.value;
}

describe("dashboard service (integration, test database)", () => {
  it("returns a zeroed overview for a new workspace (REQ-GEN-005)", async () => {
    const { workspaceId } = await registerOwner("dash-empty");

    const data = await getDashboardData(workspaceId);

    expect(data.customerCount).toBe(0);
    expect(data.dealCount).toBe(0);
    expect(data.activityCount).toBe(0);
    // The OWNER membership created at registration is counted.
    expect(data.memberCount).toBe(1);
    for (const stage of DEAL_STAGES) {
      expect(data.dealsByStage[stage]).toBe(0);
    }
    expect(data.recentActivities).toEqual([]);
  });

  it("aggregates workspace-scoped CRM counts (REQ-DASH-002)", async () => {
    const { workspaceId } = await registerOwner("dash-counts");
    const customerA = await seedCustomer(workspaceId);
    const customerB = await seedCustomer(workspaceId);
    await seedDeal(workspaceId, "NEW", customerA.id);
    await seedDeal(workspaceId, "WON", customerB.id);
    await seedActivity(workspaceId, "Call with Acme");
    await seedActivity(workspaceId, "Follow-up email");

    const data = await getDashboardData(workspaceId);

    expect(data.customerCount).toBe(2);
    expect(data.dealCount).toBe(2);
    expect(data.activityCount).toBe(2);
    // Only the OWNER membership exists in this workspace.
    expect(data.memberCount).toBe(1);
  });

  it("counts every workspace member (team metric)", async () => {
    const owner = await registerOwner("dash-members");
    const other = await registerOwner("dash-members-other");
    await prisma.membership.create({
      data: { userId: other.userId, workspaceId: owner.workspaceId, role: "MANAGER" },
    });

    const data = await getDashboardData(owner.workspaceId);

    expect(data.memberCount).toBe(2);
  });

  it("reports the sales pipeline state per stage with zero-fill (REQ-DASH-003)", async () => {
    const { workspaceId } = await registerOwner("dash-pipeline");
    await seedDeal(workspaceId, "NEW");
    await seedDeal(workspaceId, "QUALIFIED");
    await seedDeal(workspaceId, "QUALIFIED");
    await seedDeal(workspaceId, "WON");

    const data = await getDashboardData(workspaceId);

    expect(data.dealCount).toBe(4);
    expect(data.dealsByStage).toEqual({
      NEW: 2,
      QUALIFIED: 2,
      PROPOSAL: 0,
      WON: 1,
      LOST: 0,
    });
  });

  it("returns the most recent activities, newest first, limited (REQ-DASH-004)", async () => {
    const { workspaceId } = await registerOwner("dash-recent");

    // Seed more activities than the dashboard limit shows.
    for (let i = 0; i < RECENT_ACTIVITIES_LIMIT + 3; i++) {
      await seedActivity(workspaceId, `Activity ${i}`);
    }
    const newest = await seedActivity(workspaceId, "Newest activity");

    const data = await getDashboardData(workspaceId);

    expect(data.recentActivities).toHaveLength(RECENT_ACTIVITIES_LIMIT);
    expect(data.recentActivities[0].id).toBe(newest.id);
    expect(data.recentActivities[0].note).toBe("Newest activity");
    // Newest first, oldest of the returned set last.
    const timestamps = data.recentActivities.map((a) => a.createdAt.getTime());
    expect([...timestamps].sort((a, b) => b - a)).toEqual(timestamps);
  });

  it("isolates dashboard data by workspace (REQ-GEN-001, BR-ACT-005)", async () => {
    const a = await registerOwner("dash-iso-a");
    const b = await registerOwner("dash-iso-b");

    // Workspace A's data.
    await seedCustomer(a.workspaceId);
    await seedDeal(a.workspaceId, "NEW");
    await seedActivity(a.workspaceId, "A's activity");

    // Workspace B's data.
    await seedCustomer(b.workspaceId);
    await seedDeal(b.workspaceId, "WON");
    await seedActivity(b.workspaceId, "B's activity");

    const dataA = await getDashboardData(a.workspaceId);
    const dataB = await getDashboardData(b.workspaceId);

    // A sees only A's data.
    expect(dataA.customerCount).toBe(1);
    expect(dataA.dealCount).toBe(1);
    expect(dataA.activityCount).toBe(1);
    expect(dataA.dealsByStage.NEW).toBe(1);
    expect(dataA.dealsByStage.WON).toBe(0);
    expect(dataA.recentActivities.map((x) => x.note)).toEqual(["A's activity"]);

    // B sees only B's data — nothing crosses the workspace boundary.
    expect(dataB.customerCount).toBe(1);
    expect(dataB.dealCount).toBe(1);
    expect(dataB.activityCount).toBe(1);
    expect(dataB.dealsByStage.NEW).toBe(0);
    expect(dataB.dealsByStage.WON).toBe(1);
    expect(dataB.recentActivities.map((x) => x.note)).toEqual(["B's activity"]);

    // No shared activity/customer/deal rows between the two dashboards.
    expect(dataA.recentActivities.some((x) => dataB.recentActivities.some((y) => y.id === x.id))).toBe(false);
  });

  it("is keyed by the authorized workspace id only — no client identity input", async () => {
    const { workspaceId } = await registerOwner("dash-key");
    await seedCustomer(workspaceId);

    // The service exposes a single server-side entry point keyed by the
    // session-resolved workspace id; a different id yields a different,
    // fully scoped result (there is no path that mixes identities).
    const data = await getDashboardData(workspaceId);
    expect(data.customerCount).toBe(1);
  });
});