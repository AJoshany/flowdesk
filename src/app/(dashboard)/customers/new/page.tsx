import Link from "next/link";
import { CustomerForm } from "@/features/customers/components/CustomerForm";
import { requireSessionWorkspace } from "@/features/workspace/session-workspace";

export default async function NewCustomerPage() {
  // Authorization: authenticated member of a workspace (AC-CUST-002).
  await requireSessionWorkspace();

  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <Link
        href="/customers"
        className="text-link-regular-14 text-primary-accent"
      >
        ← Back to customers
      </Link>
      <h1 className="mt-2 text-h4 text-heading">New customer</h1>
      <CustomerForm mode="create" />
    </main>
  );
}