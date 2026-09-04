import { existsSync } from "node:fs";
import type { NextConfig } from "next";

// The project keeps its environment in `.env/.env.dev`, which is not one of
// the env files Next.js auto-loads. Load it before the config is evaluated so
// DATABASE_URL and AUTH_SECRET are available to the server runtime.
const envFile = ".env/.env.dev";
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
