import Link from "next/link";

type GettingStartedPanelProps = {
  customerHref: string;
  dealHref: string;
  activityHref: string;
};

/**
 * Shown on a minimal/new workspace (no customers, deals, or activities
 * yet): three actions that guide the first users into the core CRM flows
 * (REQ-GEN-005). Purely presentational — access is enforced by the
 * destination pages/actions server-side.
 */
export function GettingStartedPanel({
  customerHref,
  dealHref,
  activityHref,
}: GettingStartedPanelProps) {
  return (
    <div className="mt-6 rounded-lg border border-border bg-white p-6">
      <h2 className="text-h6 text-heading">Get started</h2>
      <p className="mt-1 text-body-regular-14 text-body-light">
        Your workspace is ready. Add your first customer, track a sales
        opportunity, or record an activity to start building your CRM.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href={customerHref}
          className="rounded-lg bg-primary-accent px-4 py-2 text-body-medium-14 text-white"
        >
          Add customer
        </Link>
        <Link
          href={dealHref}
          className="rounded-lg border border-border px-4 py-2 text-body-medium-14 text-heading transition-colors hover:bg-bg"
        >
          Add deal
        </Link>
        <Link
          href={activityHref}
          className="rounded-lg border border-border px-4 py-2 text-body-medium-14 text-heading transition-colors hover:bg-bg"
        >
          Record activity
        </Link>
      </div>
    </div>
  );
}