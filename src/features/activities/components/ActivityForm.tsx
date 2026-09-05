"use client";

import { useActionState } from "react";
import { createActivityAction } from "@/features/activities/actions";

export type ActivityCustomerOption = { id: string; name: string };
export type ActivityDealOption = { id: string; title: string };

type ActivityFormProps = {
  customers: ActivityCustomerOption[];
  deals: ActivityDealOption[];
};

function FieldErrors({ errors }: { errors?: string[] }) {
  if (!errors || errors.length === 0) {
    return null;
  }
  return (
    <ul role="alert" className="mt-1 space-y-1">
      {errors.map((message) => (
        <li key={message} className="text-body-regular-12 text-red">
          {message}
        </li>
      ))}
    </ul>
  );
}

const inputClasses =
  "w-full rounded-lg border border-border bg-white px-3 py-2 text-body-regular-14 text-heading outline-none placeholder:text-body-light focus:border-primary-light";

export function ActivityForm({ customers, deals }: ActivityFormProps) {
  const [state, formAction, pending] = useActionState(createActivityAction, null);

  return (
    <form
      action={formAction}
      className="mt-6 space-y-4 rounded-lg border border-border bg-white p-6"
    >
      <div>
        <label
          htmlFor="note"
          className="mb-1 block text-body-medium-14 text-heading"
        >
          Note
        </label>
        <textarea
          id="note"
          name="note"
          rows={4}
          required
          className={`${inputClasses} resize-y`}
          placeholder="What happened? e.g. Called to discuss renewal pricing…"
        />
        <FieldErrors errors={state?.fieldErrors?.note} />
      </div>

      <div>
        <label
          htmlFor="customerId"
          className="mb-1 block text-body-medium-14 text-heading"
        >
          Customer
        </label>
        <select
          id="customerId"
          name="customerId"
          defaultValue=""
          className={inputClasses}
        >
          <option value="">No customer</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
        <FieldErrors errors={state?.fieldErrors?.customerId} />
      </div>

      <div>
        <label
          htmlFor="dealId"
          className="mb-1 block text-body-medium-14 text-heading"
        >
          Deal
        </label>
        <select
          id="dealId"
          name="dealId"
          defaultValue=""
          className={inputClasses}
        >
          <option value="">No deal</option>
          {deals.map((deal) => (
            <option key={deal.id} value={deal.id}>
              {deal.title}
            </option>
          ))}
        </select>
        <FieldErrors errors={state?.fieldErrors?.dealId} />
      </div>

      {state?.error ? (
        <p role="alert" className="text-body-regular-14 text-red">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-primary-accent px-4 py-2 text-body-medium-14 text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Saving…" : "Record activity"}
      </button>
    </form>
  );
}
