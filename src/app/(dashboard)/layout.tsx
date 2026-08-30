import Sidebar from "@/app/components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr] grid-rows-[64px_1fr]">
      <aside className="row-span-2 shrink-0 border-r border-border bg-white">
        <Sidebar />
      </aside>

      <header className="border-b">
        <Topbar />
      </header>

      <main className="overflow-auto p-6">{children}</main>
    </div>
  );
}
