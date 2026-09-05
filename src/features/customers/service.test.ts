import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { registerUser } from "@/features/auth/services";
import { uniqueEmail } from "../../../tests/helpers/env";
import {
  createCustomer,
  deleteCustomer,
  getCustomerById,
  listCustomers,
  updateCustomer,
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

async function seedCustomer(workspaceId: string, email: string) {
  const result = await createCustomer(workspaceId, {
    name: `Customer ${email}`,
    email,
    phone: null,
    company: null,
  });
  if (!result.ok) throw new Error("seed customer failed");
  return result.value;
}

describe("customer service (integration, test database)", () => {
  it("creates a customer under the given workspace (AC-CUST-002, BR-CUST-001)", async () => {
    const { workspaceId } = await registerOwner("cust-create");
    const customer = await seedCustomer(workspaceId, uniqueEmail("c-create"));

    const row = await prisma.customer.findUnique({ where: { id: customer.id } });
    expect(row?.workspaceId).toBe(workspaceId);
    expect(row?.name).toBeTruthy();
  });

  it("lists only customers of the workspace (AC-CUST-001)", async () => {
    const a = await registerOwner("cust-list-a");
    const b = await registerOwner("cust-list-b");

    const aCustomer = await seedCustomer(a.workspaceId, uniqueEmail("c-list-a"));
    await seedCustomer(b.workspaceId, uniqueEmail("c-list-b"));

    const listA = await listCustomers(a.workspaceId);
    expect(listA.map((c) => c.id)).toContain(aCustomer.id);
    expect(listA.every((c) => c.workspaceId === a.workspaceId)).toBe(true);

    // Nothing from workspace B leaks into A's list.
    const listB = await listCustomers(b.workspaceId);
    expect(listA.some((c) => listB.some((x) => x.id === c.id))).toBe(false);
  });

  it("returns an empty list for a workspace with no customers", async () => {
    const { workspaceId } = await registerOwner("cust-empty");
    await expect(listCustomers(workspaceId)).resolves.toEqual([]);
  });

  it("resolves a customer only inside its own workspace (AC-CUST-006)", async () => {
    const a = await registerOwner("cust-scope-a");
    const b = await registerOwner("cust-scope-b");
    const customer = await seedCustomer(a.workspaceId, uniqueEmail("c-scope"));

    await expect(getCustomerById(a.workspaceId, customer.id)).resolves.toMatchObject({
      id: customer.id,
    });
    // Same id from another workspace → null (missing/foreign indistinguishable).
    await expect(getCustomerById(b.workspaceId, customer.id)).resolves.toBeNull();
  });

  it("returns null for an invalid/unknown customer id", async () => {
    const { workspaceId } = await registerOwner("cust-badid");
    await expect(getCustomerById(workspaceId, "not-a-real-id")).resolves.toBeNull();
    await expect(getCustomerById(workspaceId, "")).resolves.toBeNull();
  });

  it("rejects a duplicate email within the workspace and allows it across workspaces", async () => {
    const a = await registerOwner("cust-dup-a");
    const b = await registerOwner("cust-dup-b");
    const email = uniqueEmail("c-dup");

    const first = await createCustomer(a.workspaceId, {
      name: "One",
      email,
      phone: null,
      company: null,
    });
    expect(first.ok).toBe(true);

    const second = await createCustomer(a.workspaceId, {
      name: "Two",
      email,
      phone: null,
      company: null,
    });
    expect(second).toEqual({ ok: false, code: "duplicate" });

    // The same email is fine in another workspace (per-workspace uniqueness).
    const other = await createCustomer(b.workspaceId, {
      name: "Three",
      email,
      phone: null,
      company: null,
    });
    expect(other.ok).toBe(true);
  });

  it("updates a customer and detects concurrent updates (AC-CUST-003, §9 edge case)", async () => {
    const { workspaceId } = await registerOwner("cust-update");
    const customer = await seedCustomer(workspaceId, uniqueEmail("c-update"));

    // Stale expectedUpdatedAt → conflict, nothing written.
    const stale = new Date(customer.updatedAt.getTime() - 60_000);
    const conflict = await updateCustomer(
      workspaceId,
      customer.id,
      { name: "Renamed", email: customer.email, phone: null, company: null },
      stale
    );
    expect(conflict).toEqual({ ok: false, code: "conflict" });

    // Correct expectedUpdatedAt → updated and persisted.
    const updated = await updateCustomer(
      workspaceId,
      customer.id,
      { name: "Renamed Inc", email: customer.email, phone: "+1 555", company: "Renamed" },
      customer.updatedAt
    );
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.value.name).toBe("Renamed Inc");
    }
    const row = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
    expect(row.name).toBe("Renamed Inc");
  });

  it("cannot update a customer from another workspace (cross-workspace update rejected)", async () => {
    const a = await registerOwner("cust-xupd-a");
    const b = await registerOwner("cust-xupd-b");
    const customer = await seedCustomer(a.workspaceId, uniqueEmail("c-xupd"));

    const result = await updateCustomer(
      b.workspaceId,
      customer.id,
      { name: "Hijacked", email: customer.email, phone: null, company: null },
      customer.updatedAt
    );
    expect(result).toEqual({ ok: false, code: "not_found" });

    const row = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
    expect(row.name).not.toBe("Hijacked");
  });

  it("deletes a customer and rejects cross-workspace deletion (AC-CUST-004/006)", async () => {
    const a = await registerOwner("cust-del-a");
    const b = await registerOwner("cust-del-b");
    const customer = await seedCustomer(a.workspaceId, uniqueEmail("c-del"));

    // B cannot delete A's customer.
    const foreign = await deleteCustomer(b.workspaceId, customer.id);
    expect(foreign).toEqual({ ok: false, code: "not_found" });
    await expect(
      prisma.customer.findUnique({ where: { id: customer.id } })
    ).resolves.not.toBeNull();

    // A can delete it.
    const own = await deleteCustomer(a.workspaceId, customer.id);
    expect(own).toEqual({ ok: true, value: null });
    await expect(
      prisma.customer.findUnique({ where: { id: customer.id } })
    ).resolves.toBeNull();
  });

  it("reports not_found when deleting a missing customer (§9 edge case)", async () => {
    const { workspaceId } = await registerOwner("cust-del-missing");
    await expect(deleteCustomer(workspaceId, "missing-id")).resolves.toEqual({
      ok: false,
      code: "not_found",
    });
  });
});