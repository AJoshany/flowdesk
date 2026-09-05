export default function DashboardLoading() {
  return (
    <main className="p-8">
      <div className="h-9 w-40 animate-pulse rounded-lg bg-grey/40" />
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="h-24 animate-pulse rounded-lg bg-grey/40" />
        <div className="h-24 animate-pulse rounded-lg bg-grey/40" />
        <div className="h-24 animate-pulse rounded-lg bg-grey/40" />
        <div className="h-24 animate-pulse rounded-lg bg-grey/40" />
      </div>
      <div className="mt-6 h-6 w-40 animate-pulse rounded-lg bg-grey/40" />
      <div className="mt-2 space-y-2">
        <div className="h-14 animate-pulse rounded-lg bg-grey/40" />
        <div className="h-14 animate-pulse rounded-lg bg-grey/40" />
        <div className="h-14 animate-pulse rounded-lg bg-grey/40" />
      </div>
      <div className="mt-6 h-6 w-40 animate-pulse rounded-lg bg-grey/40" />
      <div className="mt-2 space-y-2">
        <div className="h-20 animate-pulse rounded-lg bg-grey/40" />
        <div className="h-20 animate-pulse rounded-lg bg-grey/40" />
      </div>
    </main>
  );
}