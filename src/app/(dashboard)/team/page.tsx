import Link from "next/link";
import { MemberRoleForm } from "@/features/team/components/MemberRoleForm";
import { RemoveMemberForm } from "@/features/team/components/RemoveMemberForm";
import { RoleBadge } from "@/features/team/components/RoleBadge";
import { TEAM_ROLES, type TeamRole } from "@/features/team/roles";
import { listTeamMembers } from "@/features/team/service";
import { requireSessionWorkspace } from "@/features/workspace/session-workspace";

export default async function TeamPage() {
  // Authorization: authenticated member → server-resolved workspace → scoped
  // team list (AC-TEAM-001). Only this workspace's members are ever loaded.
  const { user, workspace } = await requireSessionWorkspace();
  const members = await listTeamMembers(workspace.workspaceId);

  const isOwner = workspace.role === "OWNER";
  const isManager = workspace.role === "MANAGER";
  const canInvite = isOwner || isManager;
  // Roles the actor may assign. The server enforces the same boundary
  // independently of this UI (BR-TEAM-007, finalized MANAGER rules).
  const assignableRoles: TeamRole[] = isOwner
    ? [...TEAM_ROLES]
    : ([...TEAM_ROLES].filter((role) => role !== "OWNER") as TeamRole[]);

  return (
    <main className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h4 text-heading">Team</h1>
          <p className="mt-1 text-body-regular-14 text-body-light">
            Members of {workspace.workspaceName}
          </p>
        </div>
        {canInvite ? (
          <Link
            href="/team/invite"
            className="rounded-lg bg-primary-accent px-4 py-2 text-body-medium-14 text-white"
          >
            Invite member
          </Link>
        ) : null}
      </div>

      <ul className="mt-6 space-y-2">
        {members.map((member) => {
          const isCurrentUser = member.userId === user.id;
          // Role controls: hidden on the current user's own row (self role
          // changes are rejected server-side) and on OWNER rows for MANAGERs.
          const showRoleForm =
            (isOwner || isManager) &&
            !isCurrentUser &&
            !(isManager && member.role === "OWNER");
          // Removal is OWNER-only and never targets an OWNER (BR-TEAM-009).
          const showRemove = isOwner && member.role !== "OWNER";

          return (
            <li
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-white p-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-body-medium-14 text-heading">
                    {member.email}
                  </span>
                  {isCurrentUser ? (
                    <span className="text-body-regular-12 text-body-light">
                      (you)
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <RoleBadge role={member.role} />
                {showRoleForm ? (
                  <MemberRoleForm
                    membershipId={member.id}
                    currentRole={member.role}
                    assignableRoles={assignableRoles}
                  />
                ) : null}
                {showRemove ? <RemoveMemberForm membershipId={member.id} /> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}