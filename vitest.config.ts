import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Importing real next-auth inside Vitest pulls Next.js internals that
      // cannot be resolved outside a Next runtime. Unit tests only need the
      // AuthError class; real Auth.js behavior is covered by the HTTP e2e suite.
      "next-auth": fileURLToPath(
        new URL("./tests/helpers/next-auth-shim.ts", import.meta.url)
      ),
    },
  },
  test: {
    environment: "node",
    globalSetup: ["./tests/global-setup.ts"],
    setupFiles: ["./tests/vitest.setup.ts"],
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    server: {
      deps: {
        // next-auth ships Next.js-internal imports (e.g. next/server) that
        // Vite cannot resolve standalone; load it natively instead.
        external: ["next-auth", "@auth/core"],
      },
    },
  },
});
