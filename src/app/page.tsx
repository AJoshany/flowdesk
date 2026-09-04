import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/session";

// Approved MVP decision for the root route:
// - authenticated → /dashboard
// - unauthenticated → /login
export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? "/dashboard" : "/login");
}
