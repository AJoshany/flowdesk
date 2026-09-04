import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("hashes a password with bcrypt and verifies it round-trips", async () => {
    const hash = await hashPassword("correct-horse-battery");
    expect(hash).not.toBe("correct-horse-battery");
    expect(hash.startsWith("$2")).toBe(true);
    await expect(verifyPassword("correct-horse-battery", hash)).resolves.toBe(
      true
    );
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct-horse-battery");
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("produces a different hash for the same password (salting)", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
  });

  it("never stores the plaintext password", async () => {
    const hash = await hashPassword("plaintext-never-stored");
    expect(hash.includes("plaintext-never-stored")).toBe(false);
  });
});
