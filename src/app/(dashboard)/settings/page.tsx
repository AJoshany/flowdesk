import Link from "next/link";
import { notFound } from "next/navigation";
import { RoleBadge } from "@/features/team/components/RoleBadge";
import { RenameWorkspaceForm } from "@/features/settings/components/RenameWorkspaceForm";
import { getWorkspaceSettings } from "@/features/settings/service";
import { requireSessionWorkspace } from "@/features/workspace/session-workspace";

export default async function SettingsPage() {
  // Authorization: authenticated member → server-resolved workspace → scoped
  // settings overview. Only the member's own workspace is ever loaded.
  const { user, workspace } = await requireSessionWorkspace();
  const settings = await getWorkspaceSettings(
    workspace.workspaceId,
    user.id
  );
  if (!settings) {
    notFound();
  }

  // UI reflects the role; the server action enforces it independently.
  const isOwner = workspace.role === "OWNER";

  return (
    <main className="p-8">
      <div>
        <h1 className="text-h4 text-heading">Settings</h1>
        <p className="mt-1 text-body-regular-14 text-body-light">
          Manage your workspace and account.
        </p>
      </div>

      {/* Workspace */}
      <section className="mt-6">
        <h2 className="text-h6 text-heading">Workspace</h2>
        <div className="mt-2 rounded-lg border border-border bg-white p-6">
          <dl className="space-y-2 text-body-regular-14">
            <div>
              <dt className="inline text-body-light">Name: </dt>
              <dd className="inline text-heading">{settings.name}</dd>
            </div>
            <div>
              <dt className="inline text-body-light">Members: </dt>
              <dd className="inline text-heading">{settings.memberCount}</dd>
            </div>
            <div>
              <dt className="inline text-body-light">Created: </dt>
              <dd className="inline text-heading">
                {settings.createdAt.toLocaleDateString()}
              </dd>
            </div>
          </dl>

          {isOwner ? (
            <RenameWorkspaceForm currentName={settings.name} />
          ) : (
            <p className="mt-4 text-body-regular-12 text-body-light">
              Only workspace owners can rename the workspace.{" "}
              <Link href="/team" className="text-link-regular-14 text-primary-accent">
                Manage team members
              </Link>
            </p>
          )}
        </div>
      </section>

      {/* Account */}
      <section className="mt-6">
        <h2 className="text-h6 text-heading">Account</h2>
        <div className="mt-2 rounded-lg border border-border bg-white p-6">
          <dl className="space-y-2 text-body-regular-14">
            <div className="flex flex-wrap items-center gap-2">
              <dt className="text-body-light">Email: </dt>
              <dd className="text-heading">{user.email}</dd>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <dt className="text-body-light">Role: </dt>
              <dd>
                <RoleBadge role={workspace.role} />
              </dd>
            </div>
            <div>
              <dt className="inline text-body-light">Member since: </dt>
              <dd className="inline text-heading">
                {settings.joinedAt.toLocaleDateString()}
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </main>
  );
}