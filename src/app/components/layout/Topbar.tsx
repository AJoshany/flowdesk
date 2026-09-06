"use client";

import { usePathname } from "next/navigation";

type TopbarProps = {
  onMenuToggle: () => void;
};

/** Map route segments to page titles. */
const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/customers": "Customers",
  "/deals": "Deals",
  "/activities": "Activities",
  "/team": "Team",
  "/settings": "Settings",
};

function getPageTitle(pathname: string): string {
  // Exact match
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  // Prefix match (e.g. /customers/abc → Customers)
  const segment = "/" + pathname.split("/").filter(Boolean)[0];
  return PAGE_TITLES[segment] ?? "FlowDesk";
}

function Topbar({ onMenuToggle }: TopbarProps) {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-white px-4 lg:px-8">
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={onMenuToggle}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-heading transition-colors hover:bg-bg lg:hidden"
        aria-label="Open sidebar"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      {/* Page title (visible on mobile, less prominent on desktop) */}
      <h1 className="text-body-medium-14 text-heading lg:hidden">{title}</h1>
    </header>
  );
}

export default Topbar;
