import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/session";

// Shared layout for the public auth pages. Defense in depth on top of the
// middleware check: an authenticated user visiting /login or /register is
// sent to the dashboard (approved MVP decision).
export default async function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="text-h5 text-primary-accent">FlowDesk</span>
        </div>
        {children}
      </div>
    </div>
  );
}
