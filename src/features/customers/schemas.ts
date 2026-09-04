import { z } from "zod";

const name = z
  .string()
  .trim()
  .min(1, "Name is required.")
  .max(200, "Name must be at most 200 characters.");

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Email must be at most 254 characters.")
  .pipe(z.email("Enter a valid email address."));

/** Optional field: trimmed, length-limited, empty/missing/null → null. */
function optionalTrimmed(maxLength: number, label: string) {
  return z
    .string()
    .trim()
    .max(maxLength, `${label} must be at most ${maxLength} characters.`)
    .nullish()
    .transform((value) => (value ? value : null));
}

/** Shared customer fields for create and update (full-record update). */
export const customerFieldsSchema = z.object({
  name,
  email,
  phone: optionalTrimmed(50, "Phone"),
  company: optionalTrimmed(200, "Company"),
});

export const createCustomerSchema = customerFieldsSchema;

export const updateCustomerSchema = customerFieldsSchema;

/** Hidden-field validation: customer id (invalid IDs rejected). */
export const customerIdSchema = z
  .string()
  .min(1, "Customer id is required.")
  .max(64, "Invalid customer id.")
  .regex(/^[a-z0-9]+$/i, "Invalid customer id.");

/** Hidden-field validation: optimistic-concurrency timestamp. */
export const expectedUpdatedAtSchema = z.coerce.date();

export type CustomerFieldsInput = z.infer<typeof customerFieldsSchema>;