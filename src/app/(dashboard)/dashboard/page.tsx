import Link from "next/link";
import { ActivityList } from "@/features/activities/components/ActivityList";
import { DashboardEmptyNote } from "@/features/dashboard/components/DashboardEmptyNote";
import { GettingStartedPanel } from "@/features/dashboard/components/GettingStartedPanel";
import { PipelineOverview } from "@/features/dashboard/components/PipelineOverview";
import { StatCard } from "@/features/dashboard/components/StatCard";
import { getDashboardData } from "@/features/dashboard/service";
import { requireSessionWorkspace } from "@/features/workspace/session-workspace";

export default async function DashboardPage() {
  // Authorization: authenticated member → server-resolved workspace → scoped
  // dashboard data (REQ-DASH-001). The workspace id used for every
  // aggregation comes exclusively from the session context; no query
  // parameters or client state can influence it.
  const { workspace } = await requireSessionWorkspace();
  const data = await getDashboardData(workspace.workspaceId);

  const isEmptyWorkspace =
    data.customerCount === 0 && data.dealCount === 0 && data.activityCount === 0;

  return (
    <main className="p-8">
      <div>
        <h1 className="text-h4 text-heading">Dashboard</h1>
        <p className="mt-1 text-body-regular-14 text-body-light">
          Overview of {workspace.workspaceName}
        </p>
      </div>

      {isEmptyWorkspace ? (
        <GettingStartedPanel
          customerHref="/customers/new"
          dealHref="/deals/new"
          activityHref="/activities/new"
        />
      ) : null}

      {/* CRM overview (REQ-DASH-002) — workspace-scoped counts */}
      <section className="mt-6">
        <h2 className="text-h6 text-heading">CRM overview</h2>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Customers" value={data.customerCount} href="/customers" />
          <StatCard label="Deals" value={data.dealCount} href="/deals" />
          <StatCard label="Activities" value={data.activityCount} href="/activities" />
          <StatCard label="Team members" value={data.memberCount} href="/team" />
        </div>
      </section>

      {/* Sales pipeline (REQ-DASH-003) */}
      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-h6 text-heading">Sales pipeline</h2>
          <Link
            href="/deals"
            className="text-link-regular-14 text-primary-accent"
          >
            View all
          </Link>
        </div>
        {data.dealCount === 0 ? (
          <DashboardEmptyNote
            title="No deals yet"
            message="Create your first deal to start tracking your sales pipeline."
            href="/deals/new"
            ctaLabel="New deal"
          />
        ) : (
          <PipelineOverview dealsByStage={data.dealsByStage} />
        )}
      </section>

      {/* Recent activity (REQ-DASH-004) */}
      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-h6 text-heading">Recent activity</h2>
          <Link
            href="/activities"
            className="text-link-regular-14 text-primary-accent"
          >
            View all
          </Link>
        </div>
        {data.recentActivities.length === 0 ? (
          <DashboardEmptyNote
            title="No activities yet"
            message="Record customer and sales interactions to build your activity history."
            href="/activities/new"
            ctaLabel="Record activity"
          />
        ) : (
          <div className="mt-2">
            <ActivityList activities={data.recentActivities} />
          </div>
        )}
      </section>
    </main>
  );
}