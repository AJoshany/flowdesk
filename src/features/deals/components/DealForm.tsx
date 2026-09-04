"use client";

import { useActionState } from "react";
import {
  createDealAction,
  updateDealAction,
} from "@/features/deals/actions";
import { DEAL_STAGE_LABELS, DEAL_STAGES } from "@/features/deals/stages";

export type DealCustomerOption = { id: string; name: string };

type DealFormProps = {
  mode: "create" | "edit";
  customers: DealCustomerOption[];
  deal?: {
    id: string;
    title: string;
    stage: string;
    customerId: string | null;
    updatedAt: string;
  };
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

export function DealForm({ mode, customers, deal }: DealFormProps) {
  const action = mode === "create" ? createDealAction : updateDealAction;
  const [state, formAction, pending] = useActionState(action, null);
  const isEdit = mode === "edit";

  return (
    <form
      action={formAction}
      className="mt-6 space-y-4 rounded-lg border border-border bg-white p-6"
    >
      {isEdit && deal ? (
        <>
          <input type="hidden" name="dealId" value={deal.id} />
          <input
            type="hidden"
            name="expectedUpdatedAt"
            value={deal.updatedAt}
          />
        </>
      ) : null}

      <div>
        <label
          htmlFor="title"
          className="mb-1 block text-body-medium-14 text-heading"
        >
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          defaultValue={isEdit ? deal?.title : undefined}
          className={inputClasses}
          placeholder="e.g. Enterprise onboarding"
        />
        <FieldErrors errors={state?.fieldErrors?.title} />
      </div>

      <div>
        <label
          htmlFor="stage"
          className="mb-1 block text-body-medium-14 text-heading"
        >
          Stage
        </label>
        <select
          id="stage"
          name="stage"
          required
          defaultValue={isEdit ? deal?.stage : "NEW"}
          className={inputClasses}
        >
          {DEAL_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {DEAL_STAGE_LABELS[stage]}
            </option>
          ))}
        </select>
        <FieldErrors errors={state?.fieldErrors?.stage} />
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
          defaultValue={isEdit ? (deal?.customerId ?? "") : ""}
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
        {pending
          ? isEdit
            ? "Saving…"
            : "Creating…"
          : isEdit
            ? "Save changes"
            : "Create deal"}
      </button>
    </form>
  );
}
