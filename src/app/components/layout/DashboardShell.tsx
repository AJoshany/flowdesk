"use client";

import { useState, useCallback } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

type DashboardShellProps = {
  children: React.ReactNode;
  userEmail: string;
  workspaceName: string;
};

export default function DashboardShell({
  children,
  userEmail,
  workspaceName,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  return (
    <div className="flex h-screen bg-bg">
      <Sidebar
        userEmail={userEmail}
        workspaceName={workspaceName}
        open={sidebarOpen}
        onToggle={toggleSidebar}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar onMenuToggle={toggleSidebar} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
