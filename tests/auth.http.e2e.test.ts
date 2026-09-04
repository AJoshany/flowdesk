import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createRequire } from "node:module";
import net from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { registerUser } from "@/features/auth/services";
import { uniqueEmail } from "./helpers/env";

/**
 * End-to-end HTTP tests against a real Next.js dev server (no browser needed).
 *
 * These exercise the actual Auth.js framework endpoints (/api/auth/*), the
 * JWT session cookie, the middleware redirects, and the root/auth-page
 * redirects. The dev server is spawned with DATABASE_URL pointed at the
 * dedicated test database and with the same AUTH_SECRET as the workers.
 */

const BASE = "http://127.0.0.1";
let port = 0;
let server: ChildProcessWithoutNullStreams | null = null;
let baseUrl = "";
let serverOutput = "";

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address();
      if (address && typeof address === "object") {
        const p = address.port;
        srv.close(() => resolve(p));
      } else {
        srv.close(() => reject(new Error("no port")));
      }
    });
  });
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/login`);
      if (res.status === 200) {
        const text = await res.text();
        if (text.includes("FlowDesk")) return;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(
    `Dev server did not become ready.\nOutput so far:\n${serverOutput}\n${lastError ? String(lastError) : ""}`
  );
}

// -- HTTP helpers --------------------------------------------------------

type CookieJar = { header: string };

function updateJar(jar: CookieJar, setCookieHeaders: string[]): void {
  const pairs = setCookieHeaders.map((c) => c.split(";")[0]).filter(Boolean);
  if (pairs.length > 0) {
    jar.header = pairs.join("; ");
  }
}

async function fetchJsonCsrf(jar: CookieJar): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/csrf`, {
    headers: { cookie: jar.header },
  });
  updateJar(jar, res.headers.getSetCookie());
  const body = (await res.json()) as { csrfToken?: string };
  if (!body.csrfToken) throw new Error("no csrf token in response");
  return body.csrfToken;
}

async function postCredentials(
  jar: CookieJar,
  email: string,
  password: string
): Promise<Response> {
  const csrfToken = await fetchJsonCsrf(jar);
  return fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: jar.header,
    },
    body: new URLSearchParams({
      csrfToken,
      email,
      password,
      callbackUrl: `${baseUrl}/dashboard`,
    }),
  });
}

function locationOf(res: Response): string {
  return res.headers.get("location") ?? "";
}

// -- suite ---------------------------------------------------------------

describe("authentication HTTP end-to-end", () => {
  beforeAll(async () => {
    port = await getFreePort();
    baseUrl = `${BASE}:${port}`;

    const require = createRequire(import.meta.url);
    const nextBin = require.resolve("next/dist/bin/next");

    server = spawn(
      process.execPath,
      [nextBin, "dev", "-H", "127.0.0.1", "-p", String(port)],
      {
        env: {
          ...process.env,
          DATABASE_URL: process.env.DATABASE_URL ?? "",
          NEXT_TELEMETRY_DISABLED: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
    server.stdout.on("data", (d) => (serverOutput += String(d)));
    server.stderr.on("data", (d) => (serverOutput += String(d)));

    await waitForServer(baseUrl, 180_000);
  }, 200_000);

  afterAll(async () => {
    if (server) {
      server.kill();
      await new Promise((r) => server?.once("exit", r));
    }
    await prisma.$disconnect();
  });

  it("redirects unauthenticated requests to /login (AC-AUTH-005)", async () => {
    const res = await fetch(`${baseUrl}/dashboard`, { redirect: "manual" });
    expect([302, 307]).toContain(res.status);
    const location = locationOf(res);
    expect(location).toContain("/login");
    expect(location).toContain(encodeURIComponent("/dashboard"));
  });

  it("redirects unauthenticated protected routes with a callbackUrl", async () => {
    for (const path of ["/customers", "/settings", "/dashboard", "/customers/abc"]) {
      const res = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
      expect([302, 307]).toContain(res.status);
      expect(locationOf(res)).toContain("/login?callbackUrl=");
      expect(locationOf(res)).toContain(encodeURIComponent(path));
    }
  });

  it("redirects the root route: unauthenticated → /login", async () => {
    const res = await fetch(`${baseUrl}/`, { redirect: "manual" });
    expect([302, 307]).toContain(res.status);
    expect(locationOf(res)).toContain("/login");
  });

  it("authenticates with valid credentials and grants access to protected routes (AC-AUTH-003)", async () => {
    const email = uniqueEmail("http-login");
    const seeded = await registerUser({ email, password: "password-123" });
    expect(seeded.ok).toBe(true);

    const jar: CookieJar = { header: "" };
    const res = await postCredentials(jar, email, "password-123");
    expect([200, 302, 303]).toContain(res.status);
    updateJar(jar, res.headers.getSetCookie());

    // The session cookie must be present.
    expect(jar.header).toContain("session-token");

    // /api/auth/session carries only minimal identity data.
    const sessionRes = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { cookie: jar.header },
    });
    const session = (await sessionRes.json()) as {
      user?: Record<string, unknown>;
    };
    expect(session.user?.id).toBeTruthy();
    expect(session.user?.email).toBe(email);
    const serialized = JSON.stringify(session);
    expect(serialized.includes("passwordHash")).toBe(false);
    expect(serialized.includes("role")).toBe(false);
    expect(serialized.includes("workspace")).toBe(false);

    // Authenticated access to protected routes succeeds.
    const dashboard = await fetch(`${baseUrl}/dashboard`, {
      headers: { cookie: jar.header },
    });
    expect(dashboard.status).toBe(200);

    // Root redirects authenticated users to /dashboard.
    const root = await fetch(`${baseUrl}/`, {
      redirect: "manual",
      headers: { cookie: jar.header },
    });
    expect([302, 307]).toContain(root.status);
    expect(locationOf(root)).toContain("/dashboard");

    // Authenticated users are redirected away from /login and /register.
    for (const authPage of ["/login", "/register"]) {
      const pageRes = await fetch(`${baseUrl}${authPage}`, {
        redirect: "manual",
        headers: { cookie: jar.header },
      });
      expect([302, 307]).toContain(pageRes.status);
      expect(locationOf(pageRes)).toContain("/dashboard");
    }
  });

  it("rejects invalid credentials and keeps protected resources inaccessible (AC-AUTH-004)", async () => {
    const email = uniqueEmail("http-wrongpw");
    const seeded = await registerUser({ email, password: "password-123" });
    expect(seeded.ok).toBe(true);

    const jar: CookieJar = { header: "" };
    const res = await postCredentials(jar, email, "wrong-password");
    expect([200, 302, 303]).toContain(res.status);
    expect(locationOf(res)).toContain("error=");

    // No session cookie was issued.
    const session = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { cookie: jar.header },
    });
    expect(await session.json()).toEqual({});

    // Protected routes still require authentication.
    const dashboard = await fetch(`${baseUrl}/dashboard`, {
      redirect: "manual",
      headers: { cookie: jar.header },
    });
    expect([302, 307]).toContain(dashboard.status);
  });

  it("preserves the original destination through the callbackUrl flow", async () => {
    const email = uniqueEmail("http-callback");
    await registerUser({ email, password: "password-123" });

    const jar: CookieJar = { header: "" };
    const csrfToken = await fetchJsonCsrf(jar);
    const res = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
      method: "POST",
      redirect: "manual",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: jar.header,
      },
      body: new URLSearchParams({
        csrfToken,
        email,
        password: "password-123",
        callbackUrl: `${baseUrl}/customers`,
      }),
    });
    expect([200, 302, 303]).toContain(res.status);
    updateJar(jar, res.headers.getSetCookie());

    const customers = await fetch(`${baseUrl}/customers`, {
      headers: { cookie: jar.header },
    });
    expect(customers.status).toBe(200);
  });

  it("terminates the session on logout; protected routes require auth again (AC-AUTH-006)", async () => {
    const email = uniqueEmail("http-logout");
    await registerUser({ email, password: "password-123" });

    const jar: CookieJar = { header: "" };
    const loginRes = await postCredentials(jar, email, "password-123");
    expect([200, 302, 303]).toContain(loginRes.status);
    updateJar(jar, loginRes.headers.getSetCookie());

    // Log out through the Auth.js endpoint.
    const csrfToken = await fetchJsonCsrf(jar);
    const signOutRes = await fetch(`${baseUrl}/api/auth/signout`, {
      method: "POST",
      redirect: "manual",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: jar.header,
      },
      body: new URLSearchParams({ csrfToken }),
    });
    expect([200, 302, 303]).toContain(signOutRes.status);
    updateJar(jar, signOutRes.headers.getSetCookie());

    // No active session remains.
    const session = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { cookie: jar.header },
    });
    expect(await session.json()).toEqual({});

    // Protected resources require authentication again.
    const dashboard = await fetch(`${baseUrl}/dashboard`, {
      redirect: "manual",
      headers: { cookie: jar.header },
    });
    expect([302, 307]).toContain(dashboard.status);
    expect(locationOf(dashboard)).toContain("/login");
  });

  it("serves the public login and register pages to unauthenticated users", async () => {
    for (const page of ["/login", "/register"]) {
      const res = await fetch(`${baseUrl}${page}`);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("FlowDesk");
    }
  });
});
