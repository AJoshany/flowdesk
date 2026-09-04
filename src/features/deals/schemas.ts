import { z } from "zod";
import { DEAL_STAGES, type DealStage } from "./stages";

const title = z
  .string()
  .trim()
  .min(1, "Title is required.")
  .max(200, "Title must be at most 200 characters.");

const stage = z.enum(DEAL_STAGES, { error: "Select a valid stage." });

/**
 * Optional customer association (BR-DEAL-002): missing/empty → null. The id is
 * shape-validated here; whether the customer exists *in the same workspace* is
 * verified by the service before persistence (cross-workspace references are
 * rejected there, never by the client).
 */
const customerId = z
  .string()
  .trim()
  .max(64, "Invalid customer.")
  // Empty (optional) or well-shaped; shape-checked here, existence and
  // same-workspace membership verified by the service.
  .regex(/^[a-z0-9]*$/i, "Invalid customer.")
  .nullish()
  .transform((value) => (value ? value : null));

/** Shared deal fields: title, optional customer, and the pipeline stage. */
export const dealFieldsSchema = z.object({
  title,
  stage,
  customerId,
});

/** Create: stage may be omitted and defaults to NEW (BR-DEAL-003). */
export const createDealSchema = dealFieldsSchema.extend({
  stage: stage.default("NEW"),
});

/** Update: stage is explicit so a stale form can never silently reset it. */
export const updateDealSchema = dealFieldsSchema;

/** Hidden-field validation: deal id (invalid IDs rejected). */
export const dealIdSchema = z
  .string()
  .min(1, "Deal id is required.")
  .max(64, "Invalid deal id.")
  .regex(/^[a-z0-9]+$/i, "Invalid deal id.");

/** Hidden-field validation: optimistic-concurrency timestamp. */
export const expectedUpdatedAtSchema = z.coerce.date();

export type DealFieldsInput = z.infer<typeof dealFieldsSchema>;
export type DealStageInput = DealStage;
