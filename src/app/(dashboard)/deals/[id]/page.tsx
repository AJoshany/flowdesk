import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityList } from "@/features/activities/components/ActivityList";
import { listActivitiesForDeal } from "@/features/activities/service";
import { listCustomers } from "@/features/customers/service";
import { DealForm } from "@/features/deals/components/DealForm";
import { DealStageBadge } from "@/features/deals/components/DealStageBadge";
import { DeleteDealForm } from "@/features/deals/components/DeleteDealForm";
import { getDealById } from "@/features/deals/service";
import { requireSessionWorkspace } from "@/features/workspace/session-workspace";

type DealDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function DealDetailPage({ params }: DealDetailPageProps) {
  const { id } = await params;

  // Authorization: authenticated member → server-resolved workspace → scoped
  // deal read. A foreign or missing deal is a 404 (no disclosure).
  const { workspace } = await requireSessionWorkspace();
  const deal = await getDealById(workspace.workspaceId, id);
  if (!deal) {
    notFound();
  }
  const customers = await listCustomers(workspace.workspaceId);

  // UI reflects the role; the server action enforces it independently.
  const canDelete = workspace.role !== "MEMBER";

  // Scoped activity history for this deal (AC-ACT-003).
  const activities = await listActivitiesForDeal(workspace.workspaceId, id);

  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <Link href="/deals" className="text-link-regular-14 text-primary-accent">
        ← Back to deals
      </Link>

      <div className="mt-2 rounded-lg border border-border bg-white p-6">
        <div className="flex items-center gap-3">
          <h1 className="text-h4 text-heading">{deal.title}</h1>
          <DealStageBadge stage={deal.stage} />
        </div>
        <dl className="mt-4 space-y-2 text-body-regular-14">
          <div>
            <dt className="inline text-body-light">Customer: </dt>
            <dd className="inline text-heading">
              {deal.customer ? deal.customer.name : "—"}
            </dd>
          </div>
          <div>
            <dt className="inline text-body-light">Created: </dt>
            <dd className="inline text-heading">
              {deal.createdAt.toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="inline text-body-light">Updated: </dt>
            <dd className="inline text-heading">
              {deal.updatedAt.toLocaleDateString()}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-6">
        <h2 className="text-h6 text-heading">Edit deal</h2>
        <DealForm
          mode="edit"
          customers={customers.map(({ id, name }) => ({ id, name }))}
          deal={{
            id: deal.id,
            title: deal.title,
            stage: deal.stage,
            customerId: deal.customerId,
            updatedAt: deal.updatedAt.toISOString(),
          }}
        />
      </div>

      {canDelete ? <DeleteDealForm dealId={deal.id} /> : null}

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-h6 text-heading">Recent activity</h2>
          <Link
            href="/activities/new"
            className="text-link-regular-14 text-primary-accent"
          >
            Record activity
          </Link>
        </div>
        {activities.length === 0 ? (
          <p className="mt-2 rounded-lg border border-border bg-white p-4 text-body-regular-14 text-body-light">
            No activities recorded for this deal yet.
          </p>
        ) : (
          <div className="mt-2">
            <ActivityList activities={activities} />
          </div>
        )}
      </section>
    </main>
  );
}
