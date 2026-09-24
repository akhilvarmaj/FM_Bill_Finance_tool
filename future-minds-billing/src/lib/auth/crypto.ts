import { createHash, randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";

export async function hashPassword(password: string) {
  try {
    return await hash(password);
  } catch {
    const salt = randomBytes(16).toString("hex");
    const digest = createHash("sha256").update(salt + password).digest("hex");
    return `sha256$${salt}$${digest}`;
  }
}

export async function verifyPassword(hashVal: string, password: string) {
  try {
    if (hashVal.startsWith("sha256$")) {
      const [, salt, digest] = hashVal.split("$");
      const testDigest = createHash("sha256").update(salt + password).digest("hex");
      return testDigest === digest;
    }
    return await verify(hashVal, password);
  } catch {
    return false;
  }
}

export function tokenDigest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newSessionToken() {
  return randomBytes(32).toString("base64url");
}