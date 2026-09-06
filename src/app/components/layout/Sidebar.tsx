"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useCallback } from "react";
import {
  useColorScheme,
  useEffectiveScheme,
  setColorScheme,
  type ColorScheme,
} from "@/components/theme/ColorScheme";

type SidebarProps = {
  userEmail: string;
  workspaceName?: string;
  open: boolean;
  onToggle: () => void;
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

function Sidebar({ userEmail, workspaceName, open, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const storedScheme = useColorScheme();
  const effective = useEffectiveScheme();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (open) onToggle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onToggle();
    },
    [open, onToggle]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Lock body scroll when sidebar is open on mobile
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Mobile backdrop overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex w-64 flex-col
          border-r border-border bg-white
          transition-transform duration-200 ease-in-out
          lg:static lg:translate-x-0
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-20 shrink-0 items-center justify-between px-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-accent text-h6 text-white">
                F
              </span>
              <span className="text-h5 text-heading">FlowDesk</span>
            </div>

            {/* Close button (mobile only) */}
            <button
              type="button"
              onClick={onToggle}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-heading transition-colors hover:bg-bg lg:hidden"
              aria-label="Close sidebar"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-4">
            <div className="space-y-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={`block rounded-lg px-4 py-2.5 text-body-medium-14 transition-colors ${
                    isActive(item.href)
                      ? "bg-bg text-primary-accent dark:bg-white/5 dark:text-primary-accent"
                      : "text-heading hover:bg-bg dark:text-heading dark:hover:bg-white/5"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>

          {/* User section */}
          <div className="shrink-0 border-t border-border p-4">
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
              }}
              className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-body-medium-12 text-body-light transition-colors hover:bg-bg dark:hover:bg-white/5"
            >
              <ThemeToggleIcon effective={effective} />
              <span>{effectiveThemeLabel(effective)}</span>
            </button>

            <form action={async () => {
              const { logoutAction } = await import("@/features/auth/actions");
              logoutAction();
            }} className="mt-2">
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
    </>
  );
}

export default Sidebar;
