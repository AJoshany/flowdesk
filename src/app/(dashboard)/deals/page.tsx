import Link from "next/link";
import { DealStageBadge } from "@/features/deals/components/DealStageBadge";
import { listDeals } from "@/features/deals/service";
import { requireSessionWorkspace } from "@/features/workspace/session-workspace";

export default async function DealsPage() {
  const { workspace } = await requireSessionWorkspace();
  const deals = await listDeals(workspace.workspaceId);

  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h4 text-heading">Deals</h1>
          <p className="mt-1 text-body-regular-14 text-body-light">
            Sales opportunities in {workspace.workspaceName}
          </p>
        </div>
        <Link
          href="/deals/new"
          className="rounded-lg bg-primary-accent px-4 py-2 text-body-medium-14 text-white"
        >
          New deal
        </Link>
      </div>

      {deals.length === 0 ? (
        <div className="mt-8 rounded-lg border border-border bg-white p-8 text-center">
          <p className="text-body-medium-14 text-heading">No deals yet</p>
          <p className="mt-1 text-body-regular-14 text-body-light">
            Create your first deal to start tracking sales opportunities.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {deals.map((deal) => (
            <li key={deal.id}>
              <Link
                href={`/deals/${deal.id}`}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-white p-4 transition-colors hover:bg-bg"
              >
                <div className="min-w-0">
                  <div className="truncate text-body-medium-14 text-heading">
                    {deal.title}
                  </div>
                  <div className="mt-0.5 truncate text-body-regular-12 text-body-light">
                    {deal.customer ? deal.customer.name : "No customer"}
                  </div>
                </div>
                <DealStageBadge stage={deal.stage} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
