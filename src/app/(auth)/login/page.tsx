import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { isInternalPath } from "@/features/auth/redirects";

export const metadata: Metadata = {
  title: "Sign in — FlowDesk",
};

type LoginPageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  // Only an internal path from the middleware redirect may be used as the
  // post-login destination; anything else falls back to /dashboard.
  const callbackUrl = isInternalPath(params.callbackUrl)
    ? params.callbackUrl
    : undefined;

  return <LoginForm callbackUrl={callbackUrl} />;
}
