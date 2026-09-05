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
      className="block rounded-lg border border-border bg-white p-4 transition-all hover:-translate-y-0.5 hover:bg-bg hover:shadow-sm"
    >
      <div className="text-body-regular-12 text-body-light">{label}</div>
      <div className="mt-1 text-h5 text-primary-accent">{value}</div>
    </Link>
  );
}