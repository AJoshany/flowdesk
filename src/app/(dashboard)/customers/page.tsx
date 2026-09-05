import Link from "next/link";
import { requireSessionWorkspace } from "@/features/workspace/session-workspace";
import { listCustomers } from "@/features/customers/service";

export default async function CustomersPage() {
  const { workspace } = await requireSessionWorkspace();
  const customers = await listCustomers(workspace.workspaceId);

  return (
    <main className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h4 text-heading">Customers</h1>
          <p className="mt-1 text-body-regular-14 text-body-light">
            Customer records in {workspace.workspaceName}
          </p>
        </div>
        <Link
          href="/customers/new"
          className="rounded-lg bg-primary-accent px-4 py-2 text-body-medium-14 text-white"
        >
          New customer
        </Link>
      </div>

      {customers.length === 0 ? (
        <div className="mt-8 rounded-lg border border-border bg-white p-8 text-center">
          <p className="text-body-medium-14 text-heading">No customers yet</p>
          <p className="mt-1 text-body-regular-14 text-body-light">
            Create your first customer to start building your CRM.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {customers.map((customer) => (
            <li key={customer.id}>
              <Link
                href={`/customers/${customer.id}`}
                className="block rounded-lg border border-border bg-white p-4 transition-colors hover:bg-bg"
              >
                <div className="text-body-medium-14 text-heading">
                  {customer.name}
                </div>
                <div className="mt-0.5 truncate text-body-regular-12 text-body-light">
                  {customer.email}
                  {customer.company ? ` · ${customer.company}` : ""}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}