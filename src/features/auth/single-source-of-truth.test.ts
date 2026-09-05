import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_ROOT = join(import.meta.dirname, "..", "..", "..", "src");

function collectTsFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectTsFiles(full));
    } else if (full.endsWith(".ts") && !full.endsWith(".test.ts")) {
      files.push(full);
    }
  }
  return files;
}

function relative(file: string): string {
  return file.replace(/\\/g, "/").replace(`${SRC_ROOT.replace(/\\/g, "/")}/`, "");
}

describe("single source of truth for credential verification", () => {
  const files = collectTsFiles(SRC_ROOT);

  it("password verification lives only in the authorize path", () => {
    const importers = files.filter((file) => {
      const source = readFileSync(file, "utf8");
      return source.includes("verifyPassword");
    });
    const allowed = new Set([
      "features/auth/credentials.ts", // the authorize implementation
      "features/auth/password.ts", // where verifyPassword is defined
    ]);
    for (const file of importers) {
      expect(allowed.has(relative(file)), `verifyPassword imported in ${file}`).toBe(
        true
      );
    }
  });

  it("the login/registration actions never verify credentials or touch hashes", () => {
    for (const name of ["actions.ts", "services.ts"]) {
      const source = readFileSync(
        join(SRC_ROOT, "features", "auth", name),
        "utf8"
      );
      expect(
        source.includes("verifyPassword") || source.includes("bcrypt"),
        `${name} must not import or call password verification`
      ).toBe(false);
    }
  });

  it("the login action delegates to Auth.js signIn (no direct prisma user lookup)", () => {
    const actionsSource = readFileSync(
      join(SRC_ROOT, "features", "auth", "actions.ts"),
      "utf8"
    );
    expect(actionsSource.includes('from "@/lib/prisma"')).toBe(false);
    expect(actionsSource.includes("user.findUnique")).toBe(false);
    expect(actionsSource).toContain('signIn("credentials"');
  });

  it("the session helpers never verify credentials", () => {
    const sessionSource = readFileSync(
      join(SRC_ROOT, "features", "auth", "session.ts"),
      "utf8"
    );
    expect(sessionSource.includes("verifyPassword")).toBe(false);
    expect(sessionSource.includes("bcrypt")).toBe(false);
  });
});
