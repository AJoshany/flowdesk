import Link from "next/link";
import { InviteMemberForm } from "@/features/team/components/InviteMemberForm";
import { TEAM_INVITE_UNAUTHORIZED_MESSAGE } from "@/features/team/messages";
import { TEAM_ROLES, type TeamRole } from "@/features/team/roles";
import { requireSessionWorkspace } from "@/features/workspace/session-workspace";

export default async function InviteMemberPage() {
  // Authorization: authenticated member of a workspace. MEMBERs see an
  // unauthorized notice instead of the form; the server action rejects their
  // attempts regardless (the UI is never the security boundary).
  const { workspace } = await requireSessionWorkspace();

  const canInvite = workspace.role !== "MEMBER";
  const isManager = workspace.role === "MANAGER";
  // MANAGER may only grant MANAGER/MEMBER roles (finalized role rules); the
  // server enforces the same boundary independently of this UI.
  const assignableRoles: TeamRole[] = isManager
    ? ([...TEAM_ROLES].filter((role) => role !== "OWNER") as TeamRole[])
    : [...TEAM_ROLES];

  return (
    <main className="p-8">
      <Link href="/team" className="text-link-regular-14 text-primary-accent">
        ← Back to team
      </Link>
      <h1 className="mt-2 text-h4 text-heading">Invite member</h1>

      {canInvite ? (
        <InviteMemberForm assignableRoles={assignableRoles} />
      ) : (
        <p className="mt-6 rounded-lg border border-border bg-white p-4 text-body-regular-14 text-body-light">
          {TEAM_INVITE_UNAUTHORIZED_MESSAGE}
        </p>
      )}
    </main>
  );
}