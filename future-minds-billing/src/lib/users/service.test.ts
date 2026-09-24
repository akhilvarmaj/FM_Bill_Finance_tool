import { beforeEach, expect, it, vi } from "vitest";
const database = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), updateMany: vi.fn() },
  userPermission: { deleteMany: vi.fn(), createMany: vi.fn() },
  session: { deleteMany: vi.fn() }, parent: { updateMany: vi.fn() }, auditLog: { create: vi.fn() }, $transaction: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: database }));
import { createStaff, resetAccess, updateUser } from "./service";
const admin = { id: "admin", role: "ADMIN" as const, status: "APPROVED" as const, permissions: [] };
const input = { name: "Staff Member", status: "APPROVED", permissions: ["students.view"], updatedAt: "2026-09-24T00:00:00.000Z" };
beforeEach(() => {
  vi.resetAllMocks();
  database.$transaction.mockImplementation((operation: (transaction: typeof database) => unknown) => operation(database));
  database.user.findUnique.mockResolvedValue({ id: "staff", name: "Staff Member", roleName: "STAFF", status: "PENDING", permissions: [] });
  database.user.updateMany.mockResolvedValue({ count: 1 });
});
it.each(["STAFF", "PARENT"] as const)("blocks %s user management before querying", async role => {
  const actor = { ...admin, role };
  await expect(updateUser(actor, "staff", input)).rejects.toMatchObject({ status: 403 });
  await expect(createStaff(actor, {})).rejects.toMatchObject({ status: 403 });
  await expect(resetAccess(actor, "staff", {})).rejects.toMatchObject({ status: 403 });
  expect(database.$transaction).not.toHaveBeenCalled();
});
it("records approval and permissions and revokes sessions", async () => {
  await updateUser(admin, "staff", input);
  expect(database.userPermission.createMany).toHaveBeenCalledWith({ data: [{ userId: "staff", permissionKey: "students.view" }] });
  expect(database.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "staff" } });
  expect(database.auditLog.create).toHaveBeenCalled();
});
it("rejects stale updates", async () => {
  database.user.updateMany.mockResolvedValue({ count: 0 });
  await expect(updateUser(admin, "staff", input)).rejects.toMatchObject({ status: 409 });
  expect(database.userPermission.deleteMany).not.toHaveBeenCalled();
});
it("protects admin access", async () => {
  database.user.findUnique.mockResolvedValue({ roleName: "ADMIN" });
  await expect(updateUser(admin, "admin", { ...input, permissions: [], status: "INACTIVE" })).rejects.toMatchObject({ status: 400 });
});
it("rejects parent permission grants", async () => {
  database.user.findUnique.mockResolvedValue({ roleName: "PARENT" });
  await expect(updateUser(admin, "parent", input)).rejects.toMatchObject({ status: 400 });
});