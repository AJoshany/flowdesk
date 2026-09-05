import Link from "next/link";

type DashboardEmptyNoteProps = {
  title: string;
  message: string;
  href: string;
  ctaLabel: string;
};

/**
 * Empty-state card used by the dashboard sections (REQ-GEN-005): a short
 * note plus a primary action into the relevant creation flow.
 */
export function DashboardEmptyNote({
  title,
  message,
  href,
  ctaLabel,
}: DashboardEmptyNoteProps) {
  return (
    <div className="mt-2 rounded-lg border border-border bg-white p-6 text-center">
      <p className="text-body-medium-14 text-heading">{title}</p>
      <p className="mt-1 text-body-regular-14 text-body-light">{message}</p>
      <Link
        href={href}
        className="mt-3 inline-block rounded-lg bg-primary-accent px-4 py-2 text-body-medium-14 text-white"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}