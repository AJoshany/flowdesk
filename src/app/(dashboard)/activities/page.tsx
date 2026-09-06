import Link from "next/link";
import { ActivityList } from "@/features/activities/components/ActivityList";
import { listActivities } from "@/features/activities/service";
import { requireSessionWorkspace } from "@/features/workspace/session-workspace";

export default async function ActivitiesPage() {
  const { workspace } = await requireSessionWorkspace();
  const activities = await listActivities(workspace.workspaceId);

  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h4 text-heading">Activities</h1>
          <p className="mt-1 text-body-regular-14 text-body-light">
            Recent CRM activity in {workspace.workspaceName}
          </p>
        </div>
        <Link
          href="/activities/new"
          className="rounded-lg bg-primary-accent px-4 py-2 text-body-medium-14 text-white"
        >
          Record activity
        </Link>
      </div>

      {activities.length === 0 ? (
        <div className="mt-8 rounded-lg border border-border bg-white p-8 text-center">
          <p className="text-body-medium-14 text-heading">No activities yet</p>
          <p className="mt-1 text-body-regular-14 text-body-light">
            Record customer and sales interactions to build your activity
            history.
          </p>
        </div>
      ) : (
        <div className="mt-6">
          <ActivityList activities={activities} />
        </div>
      )}
    </main>
  );
}
