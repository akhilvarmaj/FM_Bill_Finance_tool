import { describe, expect, it } from "vitest";
import { registrationSchema, loginSchema } from "./validation";
import { hashPassword, newSessionToken, tokenDigest, verifyPassword } from "./crypto";

describe("account security", () => {
  const registration = { name: "Parent One", email: "parent@example.com", password: "a long test password", role: "PARENT", mobile: "9876543210", address: "Example address" };
  it("does not allow public admin registration", () => {
    expect(registrationSchema.safeParse({ ...registration, role: "ADMIN" }).success).toBe(false);
  });
  it("requires a parent address and strong password length", () => {
    expect(registrationSchema.safeParse({ ...registration, address: "" }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...registration, password: "short" }).success).toBe(false);
    expect(registrationSchema.safeParse(registration).success).toBe(true);
  });
  it("normalizes email addresses", () => {
    expect(loginSchema.parse({ email: "Parent@Example.com", password: "test" }).email).toBe("parent@example.com");
  });
  it("hashes passwords with Argon2id and rejects incorrect passwords", async () => {
    const hash = await hashPassword(registration.password);
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, registration.password)).toBe(true);
    expect(await verifyPassword(hash, "wrong password")).toBe(false);
  });
  it("generates unique tokens and stores only a digest", () => {
    const token = newSessionToken();
    expect(token).not.toBe(newSessionToken());
    expect(tokenDigest(token)).toHaveLength(64);
    expect(tokenDigest(token)).not.toBe(token);
  });
});