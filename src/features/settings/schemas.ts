import { z } from "zod";

/**
 * Workspace display name (BR-WS-001: every workspace has a name). Trimmed,
 * required, and bounded — mirrors the form patterns of the other features.
 */
export const workspaceNameSchema = z
  .string()
  .trim()
  .min(1, "Workspace name is required.")
  .max(80, "Workspace name must be at most 80 characters.");

export type WorkspaceNameInput = z.infer<typeof workspaceNameSchema>;