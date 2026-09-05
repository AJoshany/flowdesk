"use client";

/**
 * Error boundary for the dashboard subtree (REQ-GEN-003). Renders a safe,
 * generic message — no internals are exposed — with a retry action.
 */
export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="p-8">
      <div className="rounded-lg border border-border bg-white p-8 text-center">
        <h1 className="text-h5 text-heading">Something went wrong</h1>
        <p className="mt-1 text-body-regular-14 text-body-light">
          The dashboard could not be loaded. Please try again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-lg bg-primary-accent px-4 py-2 text-body-medium-14 text-white"
        >
          Try again
        </button>
      </div>
    </main>
  );
}