import Link from "next/link";
import type { Activity } from "../service";

/**
 * Presentational list of activity rows, shared by the workspace feed and the
 * customer/deal detail sections. Each row links to its referenced customer
 * and deal when present.
 */
export function ActivityList({ activities }: { activities: Activity[] }) {
  return (
    <ul className="space-y-2">
      {activities.map((activity) => (
        <li
          key={activity.id}
          className="rounded-lg border border-border bg-white p-4"
        >
          <p className="whitespace-pre-line text-body-regular-14 text-heading">
            {activity.note}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 text-body-regular-12 text-body-light">
            <span>{activity.createdAt.toLocaleString()}</span>
            {activity.customer ? (
              <Link
                href={`/customers/${activity.customer.id}`}
                className="text-primary-accent"
              >
                {activity.customer.name}
              </Link>
            ) : null}
            {activity.deal ? (
              <Link
                href={`/deals/${activity.deal.id}`}
                className="text-primary-accent"
              >
                {activity.deal.title}
              </Link>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
