import Link from "next/link";
import { logoutAction } from "@/features/auth/actions";

type SidebarProps = {
  userEmail: string;
  workspaceName?: string;
};

function Sidebar({ userEmail, workspaceName }: SidebarProps) {
  return (
    <aside className="h-screen w-64 shrink-0 border-r border-border bg-white">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-20 items-center px-6">
          <span className="text-h5 text-primary-accent">FlowDesk</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4">
          <div className="space-y-2">
            <Link
              href="/dashboard"
              className="block rounded-lg px-4 py-3 text-body-medium-14 text-heading hover:bg-bg"
            >
              Dashboard
            </Link>

            <Link
              href="/customers"
              className="block rounded-lg px-4 py-3 text-body-medium-14 text-heading hover:bg-bg"
            >
              Customers
            </Link>

            <Link
              href="/deals"
              className="block rounded-lg px-4 py-3 text-body-medium-14 text-heading hover:bg-bg"
            >
              Deals
            </Link>

            <Link
              href="/activities"
              className="block rounded-lg px-4 py-3 text-body-medium-14 text-heading hover:bg-bg"
            >
              Activities
            </Link>

            <Link
              href="/team"
              className="block rounded-lg px-4 py-3 text-body-medium-14 text-heading hover:bg-bg"
            >
              Team
            </Link>

            <Link
              href="/settings"
              className="block rounded-lg px-4 py-3 text-body-medium-14 text-heading hover:bg-bg"
            >
              Settings
            </Link>
          </div>
        </nav>

        {/* User (session data resolved server-side by the dashboard layout) */}
        <div className="border-t border-border p-4">
          <div className="truncate text-body-medium-14 text-heading">
            {userEmail}
          </div>

          <div className="truncate text-body-regular-12 text-body-light">
            {workspaceName ?? "Workspace"}
          </div>

          <form action={logoutAction} className="mt-3">
            <button
              type="submit"
              className="text-body-medium-12 text-body-light transition-colors hover:text-red"
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
