import Sidebar from "@/app/components/layout/Sidebar";
import { getWorkspaceContext, requireUser } from "@/features/auth/session";

// Defense-in-depth on top of the middleware: the layout-level check is the
// authoritative server-side guard for everything under the dashboard group
// (REQ-AUTH-004 / AC-AUTH-005), regardless of middleware behavior.
export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireUser();
  const workspace = await getWorkspaceContext(user.id);

  return (
    <>
      <Sidebar
        userEmail={user.email}
        workspaceName={workspace?.workspaceName}
      />
      {children}
    </>
  );
}
