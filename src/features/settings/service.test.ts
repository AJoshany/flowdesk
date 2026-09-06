import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { registerUser } from "@/features/auth/services";
import { uniqueEmail } from "../../../tests/helpers/env";
import { getWorkspaceSettings, renameWorkspace } from "./service";

const PASSWORD = "password-123";

async function registerOwner(prefix: string): Promise<{
  userId: string;
  email: string;
  workspaceId: string;
}> {
  const email = uniqueEmail(prefix);
  const result = await registerUser({ email, password: PASSWORD });
  if (!result.ok) throw new Error(`seed failed for ${prefix}`);
  const membership = await prisma.membership.findFirstOrThrow({
    where: { userId: result.user.id },
    select: { workspaceId: true },
  });
  return {
    userId: result.user.id,
    email: result.user.email,
    workspaceId: membership.workspaceId,
  };
}

describe("settings service (integration, test database)", () => {
  it("returns workspace settings for a valid member (REQ-GEN-005)", async () => {
    const { userId, workspaceId } = await registerOwner("settings-read");

    const settings = await getWorkspaceSettings(workspaceId, userId);

    expect(settings).not.toBeNull();
    expect(settings!.name).toBe("My Workspace");
    expect(settings!.memberCount).toBe(1);
    expect(settings!.createdAt).toBeInstanceOf(Date);
    expect(settings!.joinedAt).toBeInstanceOf(Date);
  });

  it("returns null for a nonexistent workspace (no disclosure)", async () => {
    const { userId } = await registerOwner("settings-missing");

    const settings = await getWorkspaceSettings(
      "000000000000000000000000",
      userId
    );
    expect(settings).toBeNull();
  });

  it("returns null when user is not a member of the workspace", async () => {
    const a = await registerOwner("settings-nomem-a");
    const b = await registerOwner("settings-nomem-b");

    // B tries to read A's workspace settings — should be null (no disclosure).
    const settings = await getWorkspaceSettings(a.workspaceId, b.userId);
    expect(settings).toBeNull();
  });

  it("counts all members in the workspace", async () => {
    const { userId, workspaceId } = await registerOwner("settings-count");
    // Register another user and add them to the workspace.
    const other = await registerOwner("settings-count-other");
    await prisma.membership.create({
      data: { userId: other.userId, workspaceId, role: "MANAGER" },
    });

    const settings = await getWorkspaceSettings(workspaceId, userId);
    expect(settings!.memberCount).toBe(2);
  });

  it("renames a workspace as OWNER (AC settings)", async () => {
    const { workspaceId } = await registerOwner("settings-rename");

    const result = await renameWorkspace(workspaceId, "OWNER", "New Name");
    expect(result).toEqual({ ok: true, value: { name: "New Name" } });

    const row = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
    });
    expect(row.name).toBe("New Name");
  });

  it("rejects rename by a MANAGER (OWNER-only)", async () => {
    const { workspaceId } = await registerOwner("settings-rename-mgr");

    const result = await renameWorkspace(workspaceId, "MANAGER", "New Name");
    expect(result).toEqual({ ok: false, code: "unauthorized" });

    const row = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
    });
    expect(row.name).toBe("My Workspace");
  });

  it("rejects rename by a MEMBER (OWNER-only)", async () => {
    const { workspaceId } = await registerOwner("settings-rename-member");

    const result = await renameWorkspace(workspaceId, "MEMBER", "New Name");
    expect(result).toEqual({ ok: false, code: "unauthorized" });
  });

  it("rejects an empty workspace name", async () => {
    const { workspaceId } = await registerOwner("settings-rename-empty");

    const result = await renameWorkspace(workspaceId, "OWNER", "");
    expect(result).toEqual({ ok: false, code: "invalid_input" });
  });

  it("rejects a name exceeding 80 characters", async () => {
    const { workspaceId } = await registerOwner("settings-rename-long");

    const result = await renameWorkspace(
      workspaceId,
      "OWNER",
      "A".repeat(81)
    );
    expect(result).toEqual({ ok: false, code: "invalid_input" });
  });

  it("returns not_found when renaming a nonexistent workspace", async () => {
    const result = await renameWorkspace(
      "000000000000000000000000",
      "OWNER",
      "New Name"
    );
    expect(result).toEqual({ ok: false, code: "not_found" });
  });
});
