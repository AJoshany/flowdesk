"use client";

import { useActionState } from "react";
import {
  createCustomerAction,
  updateCustomerAction,
} from "@/features/customers/actions";

type CustomerFormProps = {
  mode: "create" | "edit";
  customer?: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    company: string | null;
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

export function CustomerForm({ mode, customer }: CustomerFormProps) {
  const action = mode === "create" ? createCustomerAction : updateCustomerAction;
  const [state, formAction, pending] = useActionState(action, null);
  const isEdit = mode === "edit";

  return (
    <form
      action={formAction}
      className="mt-6 space-y-4 rounded-lg border border-border bg-white p-6"
    >
      {isEdit && customer ? (
        <>
          <input type="hidden" name="customerId" value={customer.id} />
          <input
            type="hidden"
            name="expectedUpdatedAt"
            value={customer.updatedAt}
          />
        </>
      ) : null}

      <div>
        <label
          htmlFor="name"
          className="mb-1 block text-body-medium-14 text-heading"
        >
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={isEdit ? customer?.name : undefined}
          className={inputClasses}
          placeholder="Customer name"
        />
        <FieldErrors errors={state?.fieldErrors?.name} />
      </div>

      <div>
        <label
          htmlFor="email"
          className="mb-1 block text-body-medium-14 text-heading"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          defaultValue={isEdit ? customer?.email : undefined}
          className={inputClasses}
          placeholder="customer@example.com"
        />
        <FieldErrors errors={state?.fieldErrors?.email} />
      </div>

      <div>
        <label
          htmlFor="phone"
          className="mb-1 block text-body-medium-14 text-heading"
        >
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={isEdit ? (customer?.phone ?? "") : undefined}
          className={inputClasses}
          placeholder="Optional"
        />
        <FieldErrors errors={state?.fieldErrors?.phone} />
      </div>

      <div>
        <label
          htmlFor="company"
          className="mb-1 block text-body-medium-14 text-heading"
        >
          Company
        </label>
        <input
          id="company"
          name="company"
          type="text"
          defaultValue={isEdit ? (customer?.company ?? "") : undefined}
          className={inputClasses}
          placeholder="Optional"
        />
        <FieldErrors errors={state?.fieldErrors?.company} />
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
            : "Create customer"}
      </button>
    </form>
  );
}