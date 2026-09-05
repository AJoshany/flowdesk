import Link from "next/link";

type StatCardProps = {
  label: string;
  value: number;
  href: string;
};

/**
 * CRM overview stat card (REQ-DASH-002): a labeled workspace-scoped count
 * linking to its domain page.
 */
export function StatCard({ label, value, href }: StatCardProps) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-border bg-white p-4 transition-colors hover:bg-bg"
    >
      <div className="text-body-regular-12 text-body-light">{label}</div>
      <div className="mt-1 text-h5 text-heading">{value}</div>
    </Link>
  );
}