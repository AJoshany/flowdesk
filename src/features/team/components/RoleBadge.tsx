import { TEAM_ROLE_LABELS, type TeamRole } from "../roles";

const ROLE_CLASSES: Record<TeamRole, string> = {
  OWNER: "border-dark-green text-dark-green",
  MANAGER: "border-blue text-blue",
  MEMBER: "border-grey text-body-light",
};

export function RoleBadge({ role }: { role: TeamRole }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-body-medium-12 ${ROLE_CLASSES[role]}`}
    >
      {TEAM_ROLE_LABELS[role]}
    </span>
  );
}