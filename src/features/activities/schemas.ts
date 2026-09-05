import { z } from "zod";

const note = z
  .string()
  .trim()
  .min(1, "Note is required.")
  .max(2000, "Note must be at most 2000 characters.");

/**
 * Optional CRM-resource association (BR-ACT-002/003/004): missing/empty →
 * null. The id is shape-validated here; whether the referenced customer or
 * deal exists *in the same workspace* is verified by the service before
 * persistence (cross-workspace references are rejected there, never by the
 * client).
 */
function optionalAssociationId(label: string) {
  return z
    .string()
    .trim()
    .max(64, `Invalid ${label}.`)
    // Empty (optional) or well-shaped; shape-checked here only.
    .regex(/^[a-z0-9]*$/i, `Invalid ${label}.`)
    .nullish()
    .transform((value) => (value ? value : null));
}

/** Shared activity fields for creation (activities are never edited). */
export const activityFieldsSchema = z.object({
  note,
  customerId: optionalAssociationId("customer"),
  dealId: optionalAssociationId("deal"),
});

export type ActivityFieldsInput = z.infer<typeof activityFieldsSchema>;
