import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";

export function hashPassword(password: string) {
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

export function verifyPassword(hash: string, password: string) {
  return argon2.verify(hash, password);
}

export function tokenDigest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newSessionToken() {
  return randomBytes(32).toString("base64url");
}