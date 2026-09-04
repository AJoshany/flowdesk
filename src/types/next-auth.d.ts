import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  /**
   * The session carries only the minimal identity data required by the app:
   * the user's id and email. No role or workspace data is ever stored in the
   * session; membership and role are resolved server-side.
   */
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
