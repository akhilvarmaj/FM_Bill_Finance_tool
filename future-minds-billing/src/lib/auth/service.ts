import "server-only";
import { db } from "@/lib/db";
import { hashPassword, newSessionToken, tokenDigest, verifyPassword } from "./crypto";
import { loginSchema, registrationSchema } from "./validation";
import { can, isAdmin, type Permission, type Principal } from "./policy";

export const sessionLifetimeMs = 8 * 60 * 60 * 1000;
export class AuthError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

let dummyHash: Promise<string> | undefined;

export async function throttle(scope: string, identifier: string, limit: number) {
  const key = tokenDigest(`${scope}:${identifier}`);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
  const rows = await db.$queryRaw<{ attempts: number }[]>`
    INSERT INTO "AuthThrottle" ("key", "attempts", "expiresAt", "createdAt", "updatedAt")
    VALUES (${key}, 1, ${expiresAt}, ${now}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "attempts" = CASE WHEN "AuthThrottle"."expiresAt" <= ${now} THEN 1 ELSE "AuthThrottle"."attempts" + 1 END,
      "expiresAt" = CASE WHEN "AuthThrottle"."expiresAt" <= ${now} THEN ${expiresAt} ELSE "AuthThrottle"."expiresAt" END,
      "updatedAt" = ${now}
    RETURNING "attempts"
  `;
  if (!rows[0] || rows[0].attempts > limit) {
    throw new AuthError("Too many attempts. Please try again in 15 minutes.", 429);
  }
}

export async function login(input: unknown) {
  const data = loginSchema.parse(input);
  await throttle("login-global", "all", 300);
  await throttle("login-email", data.email, 10);
  const user = await db.user.findUnique({ where: { email: data.email } });
  dummyHash ??= hashPassword(newSessionToken());
  const validPassword = await verifyPassword(user?.passwordHash ?? await dummyHash, data.password);
  if (!user || !validPassword || user.status !== "APPROVED") {
    throw new AuthError("Unable to sign in. Check your details and account approval.", 401);
  }
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + sessionLifetimeMs);
  await db.$transaction(async (transaction) => {
    const approved = await transaction.user.findFirst({ where: { id: user.id, status: "APPROVED" } });
    if (!approved) throw new AuthError("Your account is not active.", 401);
    await transaction.session.create({ data: { tokenHash: tokenDigest(token), userId: user.id, expiresAt } });
    await transaction.auditLog.create({ data: { actorId: user.id, action: "LOGIN", entityId: user.id } });
  });
  return { token, expiresAt };
}

export async function register(input: unknown) {
  const data = registrationSchema.parse(input);
  await throttle("register-global", "all", 30);
  await throttle("register-email", data.email, 3);
  const passwordHash = await hashPassword(data.password);
  await db.$transaction(async (transaction) => {
    const existing = await transaction.user.findUnique({ where: { email: data.email }, select: { id: true } });
    if (existing) return;
    const user = await transaction.user.create({
      data: {
        name: data.name, email: data.email, mobile: data.mobile, passwordHash, roleName: data.role, status: "PENDING",
        ...(data.role === "PARENT" ? { parent: { create: {
          name: data.name, email: data.email, mobile: data.mobile, address: data.address,
        } } } : {}),
      },
    });
    await transaction.auditLog.create({ data: { actorId: user.id, action: "REGISTRATION_PENDING", entityId: user.id } });
  });
}

export async function findSession(token: string | undefined) {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: tokenDigest(token) },
    include: { user: { include: { permissions: true } } },
  });
  if (!session || session.expiresAt <= new Date() || session.user.status !== "APPROVED") return null;
  const user = session.user;
  return {
    id: user.id, name: user.name, email: user.email, role: user.roleName,
    status: user.status, permissions: user.permissions.map((grant) => grant.permissionKey),
  } satisfies Principal & { name: string; email: string };
}

export async function logout(token: string | undefined) {
  if (!token) return;
  await db.$transaction(async (transaction) => {
    const session = await transaction.session.findUnique({ where: { tokenHash: tokenDigest(token) } });
    if (!session) return;
    await transaction.session.delete({ where: { tokenHash: session.tokenHash } });
    await transaction.auditLog.create({ data: { actorId: session.userId, action: "LOGOUT", entityId: session.userId } });
  });
}

export function requirePermission(principal: Principal | null, permission: Permission) {
  if (!principal) throw new AuthError("Please sign in.", 401);
  if (!can(principal, permission)) throw new AuthError("You do not have permission to perform this action.", 403);
  return principal;
}

export function requireAdmin(principal: Principal | null) {
  if (!principal) throw new AuthError("Please sign in.", 401);
  if (!isAdmin(principal)) throw new AuthError("You do not have permission to perform this action.", 403);
  return principal;
}