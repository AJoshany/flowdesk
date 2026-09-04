import { DEAL_STAGE_LABELS, type DealStage } from "../stages";

const STAGE_CLASSES: Record<DealStage, string> = {
  NEW: "border-grey text-body-light",
  QUALIFIED: "border-blue text-blue",
  PROPOSAL: "border-purple text-purple",
  WON: "border-dark-green text-dark-green",
  LOST: "border-red text-red",
};

export function DealStageBadge({ stage }: { stage: DealStage }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-body-medium-12 ${STAGE_CLASSES[stage]}`}
    >
      {DEAL_STAGE_LABELS[stage]}
    </span>
  );
}
