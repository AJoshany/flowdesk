import { z } from "zod";
import { TEAM_ROLES } from "./roles";

/** Invitee email: trimmed/lowercased, valid format (same shape as Customers). */
const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Email must be at most 254 characters.")
  .pipe(z.email("Enter a valid email address."));

/**
 * Requested role — validated against the enum at the server boundary. A
 * client-supplied role value is never authoritative: whether the actor may
 * request that role is decided server-side by the service (BR-TEAM-007, §6).
 */
const role = z.enum(TEAM_ROLES, { error: "Select a valid role." });

/** Hidden-field validation: membership id (invalid IDs rejected). */
export const membershipIdSchema = z
  .string()
  .min(1, "Member id is required.")
  .max(64, "Invalid member id.")
  .regex(/^[a-z0-9]+$/i, "Invalid member id.");

/** Invite a member: email of an existing registered user + requested role. */
export const inviteMemberSchema = z.object({ email, role });

/** Change a member's role: target membership + requested role. */
export const changeRoleSchema = z.object({
  membershipId: membershipIdSchema,
  role,
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;