import Link from "next/link";
import { listCustomers } from "@/features/customers/service";
import { listDeals } from "@/features/deals/service";
import { ActivityForm } from "@/features/activities/components/ActivityForm";
import { requireSessionWorkspace } from "@/features/workspace/session-workspace";

export default async function NewActivityPage() {
  // Authorization: authenticated member of a workspace (AC-ACT-001).
  const { workspace } = await requireSessionWorkspace();
  const customers = await listCustomers(workspace.workspaceId);
  const deals = await listDeals(workspace.workspaceId);

  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <Link
        href="/activities"
        className="text-link-regular-14 text-primary-accent"
      >
        ← Back to activities
      </Link>
      <h1 className="mt-2 text-h4 text-heading">Record activity</h1>
      <ActivityForm
        customers={customers.map(({ id, name }) => ({ id, name }))}
        deals={deals.map(({ id, title }) => ({ id, title }))}
      />
    </main>
  );
}
