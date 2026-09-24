import { beforeEach, expect, it, vi } from "vitest";
const database = vi.hoisted(() => ({
  $transaction: vi.fn(), $executeRaw: vi.fn(), student: { findFirst: vi.fn() }, course: { findFirst: vi.fn() }, batch: { findFirst: vi.fn() },
  enrollment: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() }, user: { findUnique: vi.fn() }, parent: { findUnique: vi.fn(), update: vi.fn() }, session: { deleteMany: vi.fn() }, auditLog: { create: vi.fn() },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: database }));
import { addEnrollment, linkParent, updateEnrollment } from "./enrollments";
const actor = { id: "admin", role: "ADMIN" as const, status: "APPROVED" as const, permissions: [] };
const enrollment = { studentId: "student", courseId: "course", enrollmentDate: "2026-09-24", paymentPlan: "MONTHLY", fee: "100", scholarship: "10", discount: "5", billingDay: 1, dueDay: 10 };
beforeEach(() => {
  vi.resetAllMocks();
  database.$transaction.mockImplementation((operation: (transaction: typeof database) => unknown) => operation(database));
  database.student.findFirst.mockResolvedValue({ id: "student" }); database.course.findFirst.mockResolvedValue({ id: "course" });
  database.enrollment.create.mockResolvedValue({ id: "enrollment" });
  database.parent.findUnique.mockResolvedValue({ id: "family", userId: null });
  database.user.findUnique.mockResolvedValue({ id: "parent-user", roleName: "PARENT", parent: { id: "empty-profile", _count: { students: 0 } } });
});
it("requires enrollment permission and rejects incompatible batches", async () => {
  await expect(addEnrollment({ ...actor, role: "PARENT" }, enrollment)).rejects.toMatchObject({ status: 403 });
  await expect(addEnrollment(actor, { ...enrollment, batchId: "wrong" })).rejects.toMatchObject({ status: 400 });
  expect(database.enrollment.create).not.toHaveBeenCalled();
});
it("adds an existing student's enrollment and audit atomically", async () => {
  expect(await addEnrollment(actor, enrollment)).toEqual({ id: "enrollment" });
  expect(database.enrollment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ studentId: "student", fee: "100", scholarship: "10", discount: "5" }) });
  expect(database.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "ENROLLMENT_CREATED" }) });
});
it("only permits administrators to link families", async () => {
  await expect(linkParent({ ...actor, role: "STAFF" }, { parentId: "family", userId: "parent-user" })).rejects.toMatchObject({ status: 403 });
  expect(database.$transaction).not.toHaveBeenCalled();
});
it("rejects another user's family and accounts already linked to children", async () => {
  database.parent.findUnique.mockResolvedValue({ id: "family", userId: "someone-else" });
  await expect(linkParent(actor, { parentId: "family", userId: "parent-user" })).rejects.toMatchObject({ status: 409 });
  database.parent.findUnique.mockResolvedValue({ id: "family", userId: null });
  database.user.findUnique.mockResolvedValue({ id: "parent-user", roleName: "PARENT", parent: { id: "occupied", _count: { students: 1 } } });
  await expect(linkParent(actor, { parentId: "family", userId: "parent-user" })).rejects.toMatchObject({ status: 409 });
  expect(database.parent.update).not.toHaveBeenCalled();
});
it("links an unassigned family, preserves the empty profile and revokes sessions", async () => {
  await linkParent(actor, { parentId: "family", userId: "parent-user" });
  expect(database.parent.update).toHaveBeenNthCalledWith(1, { where: { id: "empty-profile" }, data: { userId: null } });
  expect(database.parent.update).toHaveBeenNthCalledWith(2, { where: { id: "family" }, data: { userId: "parent-user" } });
  expect(database.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "parent-user" } });
  expect(database.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "PARENT_ACCOUNT_LINKED" }) });
});
it("preserves billed plans and rejects stale enrollment edits", async () => {
  const updatedAt = "2026-09-24T00:00:00.000Z";
  const input = { batchId: "", enrollmentDate: "2026-09-24", paymentPlan: "MONTHLY", fee: "100", scholarship: "0", discount: "0", billingDay: 1, dueDay: 10, active: true, updatedAt };
  database.enrollment.findUnique.mockResolvedValue({ ...input, updatedAt: new Date(updatedAt), enrollmentDate: new Date(input.enrollmentDate), _count: { invoices: 1 }, courseId: "course" });
  await expect(updateEnrollment({ ...actor, role: "PARENT" }, "enrollment", input)).rejects.toMatchObject({ status: 403 });
  await expect(updateEnrollment(actor, "enrollment", { ...input, updatedAt: "2026-09-23T00:00:00.000Z" })).rejects.toMatchObject({ status: 409 });
  await expect(updateEnrollment(actor, "enrollment", { ...input, paymentPlan: "ONE_TIME" })).rejects.toMatchObject({ status: 409 });
  expect(database.enrollment.updateMany).not.toHaveBeenCalled();
  database.enrollment.updateMany.mockResolvedValue({ count: 1 });
  await updateEnrollment(actor, "enrollment", { ...input, fee: "120", active: false });
  expect(database.enrollment.updateMany).toHaveBeenCalledWith({ where: { id: "enrollment", updatedAt: new Date(updatedAt) }, data: expect.objectContaining({ fee: "120", active: false }) });
  expect(database.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "ENROLLMENT_UPDATED" }) });
});