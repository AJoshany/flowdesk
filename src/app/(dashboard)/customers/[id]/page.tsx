import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerForm } from "@/features/customers/components/CustomerForm";
import { DeleteCustomerForm } from "@/features/customers/components/DeleteCustomerForm";
import { getCustomerById } from "@/features/customers/service";
import { requireSessionWorkspace } from "@/features/workspace/session-workspace";

type CustomerDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  const { id } = await params;

  // Authorization: authenticated member → server-resolved workspace → scoped
  // customer read. A foreign or missing customer is a 404 (no disclosure).
  const { workspace } = await requireSessionWorkspace();
  const customer = await getCustomerById(workspace.workspaceId, id);
  if (!customer) {
    notFound();
  }

  // UI reflects the role; the server action enforces it independently.
  const canDelete = workspace.role !== "MEMBER";

  return (
    <main className="p-8">
      <Link
        href="/customers"
        className="text-link-regular-14 text-primary-accent"
      >
        ← Back to customers
      </Link>

      <div className="mt-2 rounded-lg border border-border bg-white p-6">
        <h1 className="text-h4 text-heading">{customer.name}</h1>
        <dl className="mt-4 space-y-2 text-body-regular-14">
          <div>
            <dt className="inline text-body-light">Email: </dt>
            <dd className="inline text-heading">{customer.email}</dd>
          </div>
          <div>
            <dt className="inline text-body-light">Phone: </dt>
            <dd className="inline text-heading">{customer.phone ?? "—"}</dd>
          </div>
          <div>
            <dt className="inline text-body-light">Company: </dt>
            <dd className="inline text-heading">{customer.company ?? "—"}</dd>
          </div>
          <div>
            <dt className="inline text-body-light">Created: </dt>
            <dd className="inline text-heading">
              {customer.createdAt.toLocaleDateString()}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-6">
        <h2 className="text-h6 text-heading">Edit customer</h2>
        <CustomerForm
          mode="edit"
          customer={{
            id: customer.id,
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            company: customer.company,
            updatedAt: customer.updatedAt.toISOString(),
          }}
        />
      </div>

      {canDelete ? <DeleteCustomerForm customerId={customer.id} /> : null}
    </main>
  );
}