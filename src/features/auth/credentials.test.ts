import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { uniqueEmail } from "../../../tests/helpers/env";
import { authorizeCredentials } from "./credentials";
import { hashPassword } from "./password";

const PASSWORD = "correct-horse-battery";

async function seedUser(email: string) {
  const passwordHash = await hashPassword(PASSWORD);
  const user = await prisma.user.create({
    data: { email, passwordHash },
    select: { id: true, email: true },
  });
  return user;
}

describe("Credentials provider authorize (single source of truth)", () => {
  it("returns { id, email } for valid credentials", async () => {
    const email = uniqueEmail("valid");
    const seeded = await seedUser(email);

    const user = await authorizeCredentials({ email, password: PASSWORD });
    expect(user).toEqual({ id: seeded.id, email });
  });

  it("returns null for an unknown email (no account-existence disclosure)", async () => {
    const result = await authorizeCredentials({
      email: uniqueEmail("ghost"),
      password: PASSWORD,
    });
    expect(result).toBeNull();
  });

  it("returns null for a wrong password", async () => {
    const email = uniqueEmail("wrongpw");
    await seedUser(email);

    const result = await authorizeCredentials({
      email,
      password: "definitely-not-the-password",
    });
    expect(result).toBeNull();
  });

  it("returns null for malformed input", async () => {
    await expect(
      authorizeCredentials({ email: "not-an-email", password: "x" })
    ).resolves.toBeNull();
    await expect(authorizeCredentials(undefined)).resolves.toBeNull();
  });

  it("never returns the password hash or role data", async () => {
    const email = uniqueEmail("minimal");
    await seedUser(email);

    const user = await authorizeCredentials({ email, password: PASSWORD });
    expect(user).not.toBeNull();
    expect(user).toEqual({
      id: expect.any(String),
      email,
    });
    const serialized = JSON.stringify(user);
    expect(serialized.includes("passwordHash")).toBe(false);
    expect(serialized.includes("OWNER")).toBe(false);
  });
});
