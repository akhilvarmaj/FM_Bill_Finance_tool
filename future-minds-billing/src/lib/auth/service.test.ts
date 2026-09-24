import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  session: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
  auditLog: { create: vi.fn() },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: database }));

import { findSession, login, logout, register, requireAdmin, requirePermission, throttle } from "./service";
import { hashPassword, newSessionToken, tokenDigest } from "./crypto";

beforeEach(() => {
  vi.resetAllMocks();
  database.$queryRaw.mockResolvedValue([{ attempts: 1 }]);
  database.$transaction.mockImplementation((operation: (transaction: typeof database) => unknown) => operation(database));
});

describe("login and registration service", () => {
  it("creates a hashed session and audit record for approved users", async () => {
    const user = { id: "user-1", status: "APPROVED", passwordHash: await hashPassword("a long test password") };
    database.user.findUnique.mockResolvedValue(user);
    database.user.findFirst.mockResolvedValue(user);
    const session = await login({ email: "parent@example.com", password: "a long test password" });
    expect(database.session.create).toHaveBeenCalledWith({ data: {
      tokenHash: tokenDigest(session.token), userId: "user-1", expiresAt: session.expiresAt,
    } });
    expect(database.auditLog.create).toHaveBeenCalledWith({ data: { actorId: "user-1", action: "LOGIN", entityId: "user-1" } });
  });
  it.each(["PENDING", "REJECTED", "INACTIVE"])("blocks a correct password for %s accounts", async (status) => {
    database.user.findUnique.mockResolvedValue({ id: "user-1", status, passwordHash: await hashPassword("a long test password") });
    await expect(login({ email: "parent@example.com", password: "a long test password" })).rejects.toMatchObject({ status: 401 });
    expect(database.session.create).not.toHaveBeenCalled();
  });
  it("rejects incorrect passwords and unknown accounts", async () => {
    database.user.findUnique.mockResolvedValue({ id: "user-1", status: "APPROVED", passwordHash: await hashPassword("a long test password") });
    await expect(login({ email: "parent@example.com", password: "wrong" })).rejects.toMatchObject({ status: 401 });
    database.user.findUnique.mockResolvedValue(null);
    await expect(login({ email: "unknown@example.com", password: "wrong" })).rejects.toMatchObject({ status: 401 });
    expect(database.session.create).not.toHaveBeenCalled();
  });
  it("creates pending parent accounts and their profile atomically", async () => {
    database.user.findUnique.mockResolvedValue(null);
    database.user.create.mockResolvedValue({ id: "new-parent" });
    await register({ name: "New Parent", email: "parent@example.com", password: "a long test password", role: "PARENT", mobile: "9876543210", address: "Example address" });
    expect(database.user.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      roleName: "PARENT", status: "PENDING", passwordHash: expect.stringMatching(/^\$argon2id\$/),
      parent: { create: { name: "New Parent", email: "parent@example.com", mobile: "9876543210", address: "Example address" } },
    }) });
    expect(database.auditLog.create).toHaveBeenCalled();
    expect(database.session.create).not.toHaveBeenCalled();
  });
  it("enforces the persistent throttle", async () => {
    database.$queryRaw.mockResolvedValue([{ attempts: 11 }]);
    await expect(throttle("login-email", "parent@example.com", 10)).rejects.toMatchObject({ status: 429 });
  });
  it("retains staff contact details without creating a parent profile", async () => {
    database.user.findUnique.mockResolvedValue(null);
    database.user.create.mockResolvedValue({ id: "new-staff" });
    await register({ name: "New Staff", email: "staff@example.com", password: "a long test password", role: "STAFF", mobile: "9876543210", address: "" });
    expect(database.user.create).toHaveBeenCalledWith({ data: {
      name: "New Staff", email: "staff@example.com", mobile: "9876543210",
      passwordHash: expect.stringMatching(/^\$argon2id\$/), roleName: "STAFF", status: "PENDING",
    } });
  });
});

describe("session validation", () => {
  const user = { id: "parent-1", name: "Parent", email: "parent@example.com", roleName: "PARENT", status: "APPROVED", permissions: [] };
  it("rejects expired and deactivated sessions", async () => {
    const token = newSessionToken();
    database.session.findUnique.mockResolvedValue({ expiresAt: new Date(0), user });
    expect(await findSession(token)).toBeNull();
    database.session.findUnique.mockResolvedValue({ expiresAt: new Date(Date.now() + 60000), user: { ...user, status: "INACTIVE" } });
    expect(await findSession(token)).toBeNull();
  });
  it("loads grants from the database on each request and never returns the password", async () => {
    database.session.findUnique.mockResolvedValue({ expiresAt: new Date(Date.now() + 60000), user: { ...user, passwordHash: "private" } });
    const principal = await findSession(newSessionToken());
    expect(principal).toMatchObject({ id: "parent-1", permissions: [] });
    expect(principal).not.toHaveProperty("passwordHash");
  });
  it("rejects invalid tokens before querying the database", async () => {
    expect(await findSession(undefined)).toBeNull();
    expect(await findSession("forged")).toBeNull();
    expect(database.session.findUnique).not.toHaveBeenCalled();
  });
  it("deletes a logged-out session and records the event", async () => {
    const token = newSessionToken();
    database.session.findUnique.mockResolvedValue({ tokenHash: tokenDigest(token), userId: "user-1" });
    await logout(token);
    expect(database.session.delete).toHaveBeenCalledWith({ where: { tokenHash: tokenDigest(token) } });
    expect(database.auditLog.create).toHaveBeenCalled();
  });
  it("enforces server-side guards", () => {
    expect(() => requirePermission(null, "students.view")).toThrow("Please sign in.");
    const staff = { id: "staff-1", role: "STAFF" as const, status: "APPROVED" as const, permissions: [] };
    expect(() => requirePermission(staff, "students.view")).toThrow("You do not have permission");
    expect(() => requireAdmin(staff)).toThrow("You do not have permission");
  });
});