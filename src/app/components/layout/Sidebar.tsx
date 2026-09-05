"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useColorScheme,
  useEffectiveScheme,
  setColorScheme,
  ColorScheme,
} from "@/components/theme/ColorScheme";
import { logoutAction } from "@/features/auth/actions";

type SidebarProps = {
  userEmail: string;
  workspaceName?: string;
};

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/customers", label: "Customers" },
  { href: "/deals", label: "Deals" },
  { href: "/activities", label: "Activities" },
  { href: "/team", label: "Team" },
  { href: "/settings", label: "Settings" },
] as const;

/** Two-letter initials from an email, e.g. demo@flowdesk.dev → "DE". */
function initialsFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  const parts = local.replace(/[^a-z0-9]+/gi, " ").trim().split(/\s+/);
  const letters = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return (letters || local.slice(0, 2) || "FD").toUpperCase();
}

/** What the user sees right now (light or dark), derived from stored + OS preference. */
function effectiveThemeLabel(eff: "light" | "dark"): string {
  return eff === "dark" ? "Dark" : "Light";
}

/** Sun icon for light, moon icon for dark. */
function ThemeToggleIcon({ effective }: { effective: "light" | "dark" }) {
  if (effective === "light") {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none"
        stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
        strokeLinejoin="round">
        <circle cx="10" cy="10" r="3.4" />
        <path d="M10 2.2s4 2 4 5.8a4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 0-1.8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
      strokeLinejoin="round">
      <path d="M17.3 10.7a7 7 0 0 1-9.9 3.6 9 9 0 0 1-5.3-9.4 7 7 0 0 1 3.4-3.4" />
      <path d="M16.9 7.1a7.9 7.9 0 0 1-1.4 5.1" />
      <path d="M4.9 12.5a7.7 7.7 0 0 1 2.9-4.5" />
    </svg>
  );
}

function Sidebar({ userEmail, workspaceName }: SidebarProps) {
  const pathname = usePathname();
  const storedScheme = useColorScheme();
  const effective = useEffectiveScheme();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="h-screen w-64 shrink-0 border-r border-border bg-white dark:bg-body-dark">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-20 items-center gap-2.5 px-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-accent text-h6 text-white">
            F
          </span>
          <span className="text-h5 text-heading">FlowDesk</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4">
          <div className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={`block rounded-lg px-4 py-2.5 text-body-medium-14 transition-colors ${
                  isActive(item.href)
                    ? "bg-bg text-primary-accent"
                    : "text-heading hover:bg-bg"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        {/* User (session data resolved server-side by the dashboard layout) */}
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light text-body-medium-14 text-primary-accent"
            >
              {initialsFromEmail(userEmail)}
            </span>
            <div className="min-w-0">
              <div className="truncate text-body-medium-14 text-heading">
                {userEmail}
              </div>
              <div className="truncate text-body-regular-12 text-body-light">
                {workspaceName ?? "Workspace"}
              </div>
            </div>
          </div>

          {/* Theme toggle — cycles Light → Dark → System */}
          <button
            type="button"
            onClick={() => {
              const next: ColorScheme =
                storedScheme === "light"
                  ? "dark"
                  : storedScheme === "dark"
                    ? "system"
                    : "light";
              setColorScheme(next);
              // no reload — ColorSchemeScript listens for the event and flips immediately
            }}
            className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-body-medium-12 text-body-light transition-colors hover:bg-bg"
          >
            <ThemeToggleIcon effective={effective} />
            <span>{effectiveThemeLabel(effective)}</span>
          </button>

          <form action={logoutAction} className="mt-2">
            <button
              type="submit"
              className="w-full text-body-medium-12 text-body-light transition-colors hover:text-red"
            >
              Log out
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;