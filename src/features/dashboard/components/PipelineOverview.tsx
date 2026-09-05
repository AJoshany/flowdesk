import { DealStageBadge } from "@/features/deals/components/DealStageBadge";
import { DEAL_STAGES, type DealStage } from "@/features/deals/stages";

type PipelineOverviewProps = {
  dealsByStage: Record<DealStage, number>;
};

/**
 * Sales pipeline overview (REQ-DASH-003): the current deal count per
 * pipeline stage. The data is server-resolved and workspace-scoped.
 */
export function PipelineOverview({ dealsByStage }: PipelineOverviewProps) {
  return (
    <ul className="mt-2 space-y-2">
      {DEAL_STAGES.map((stage) => (
        <li
          key={stage}
          className="flex items-center justify-between rounded-lg border border-border bg-white p-4"
        >
          <DealStageBadge stage={stage} />
          <span className="text-body-medium-14 text-heading">
            {dealsByStage[stage]}
          </span>
        </li>
      ))}
    </ul>
  );
}