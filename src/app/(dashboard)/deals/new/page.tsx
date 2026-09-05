import Link from "next/link";
import { listCustomers } from "@/features/customers/service";
import { DealForm } from "@/features/deals/components/DealForm";
import { requireSessionWorkspace } from "@/features/workspace/session-workspace";

export default async function NewDealPage() {
  // Authorization: authenticated member of a workspace (AC-DEAL-002).
  const { workspace } = await requireSessionWorkspace();
  const customers = await listCustomers(workspace.workspaceId);

  return (
    <main className="p-8">
      <Link href="/deals" className="text-link-regular-14 text-primary-accent">
        ← Back to deals
      </Link>
      <h1 className="mt-2 text-h4 text-heading">New deal</h1>
      <DealForm
        mode="create"
        customers={customers.map(({ id, name }) => ({ id, name }))}
      />
    </main>
  );
}
