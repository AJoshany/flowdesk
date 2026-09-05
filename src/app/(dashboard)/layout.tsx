import Sidebar from "@/app/components/layout/Sidebar";
import { requireSessionWorkspace } from "@/features/workspace/session-workspace";

// Defense-in-depth on top of the middleware: the layout-level check is the
// authoritative server-side guard for everything under the dashboard group.
// It resolves the authenticated user AND their workspace membership
// server-side (REQ-AUTH-004 / AC-AUTH-005, BR-WS-004, AC-WS-001/002):
// - unauthenticated users are redirected to /login;
// - authenticated users without a workspace membership are denied.
export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, workspace } = await requireSessionWorkspace();

  return (
    <div className="flex h-screen bg-bg">
      <Sidebar
        userEmail={user.email}
        workspaceName={workspace.workspaceName}
      />
      {/* Scrollable content column beside the fixed sidebar */}
      <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
