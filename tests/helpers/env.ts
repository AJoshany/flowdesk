import { existsSync } from "node:fs";

export const ENV_FILE = ".env/.env.dev";

/** Loads the project env file once per process (idempotent). */
export function loadProjectEnv(): void {
  if (process.env.__FLOWDESK_ENV_LOADED__) {
    return;
  }
  if (existsSync(ENV_FILE)) {
    process.loadEnvFile(ENV_FILE);
  }
  process.env.__FLOWDESK_ENV_LOADED__ = "1";
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}+${Date.now()}-${Math.random().toString(36).slice(2, 8)}@flowdesk.test`;
}
