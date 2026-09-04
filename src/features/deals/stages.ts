/**
 * Deal pipeline stages (docs/features/deals.md §6 — the exact set was left to
 * the implementation specification; documented in docs/plans/deals.md).
 *
 * The array order is the display order; no workflow engine restricts
 * transitions (the spec does not require one).
 */
export const DEAL_STAGES = [
  "NEW",
  "QUALIFIED",
  "PROPOSAL",
  "WON",
  "LOST",
] as const;

export type DealStage = (typeof DEAL_STAGES)[number];

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  NEW: "New",
  QUALIFIED: "Qualified",
  PROPOSAL: "Proposal",
  WON: "Won",
  LOST: "Lost",
};
