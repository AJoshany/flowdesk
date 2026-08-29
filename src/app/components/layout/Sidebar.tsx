import Link from "next/link";

function Sidebar() {
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
              href="/settings"
              className="block rounded-lg px-4 py-3 text-body-medium-14 text-heading hover:bg-bg"
            >
              Settings
            </Link>
          </div>
        </nav>

        {/* User */}
        <div className="border-t border-border p-4">
          <div className="text-body-medium-14 text-heading">John Doe</div>

          <div className="text-body-regular-12 text-body-light">
            Administrator
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
