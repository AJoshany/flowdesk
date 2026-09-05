import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // WASM-heavy server packages must load natively instead of being bundled by
  // Turbopack: PGlite resolves its .wasm/.data artifacts relative to its real
  // module location, and @prisma/client does the same for its query
  // compiler. When inlined into an SSR chunk, that resolution produces a URL
  // that Node's path helpers reject ("The path argument must be of type
  // string or an instance of Buffer or URL. Received an instance of URL").
  // pglite-prisma-adapter is externalized alongside PGlite so both share the
  // same class identity.
  serverExternalPackages: [
    "@electric-sql/pglite",
    "pglite-prisma-adapter",
    "@prisma/client",
  ],
  // The managed preview serves the dev server through a proxy host (e.g.
  // *.daytonaproxy01.net). Next.js 16 blocks cross-origin dev resources by
  // default; allow that domain so HMR/static chunks load in the preview.
  // Dev-only setting — ignored in production builds.
  allowedDevOrigins: ["*.daytonaproxy01.net"],
};

export default nextConfig;