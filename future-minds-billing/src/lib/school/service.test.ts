import { beforeEach, expect, it, vi } from "vitest";
const database = vi.hoisted(() => ({
  $transaction: vi.fn(), $executeRaw: vi.fn(), parent: { findUnique: vi.fn() }, course: { findFirst: vi.fn() },
  batch: { findFirst: vi.fn() }, student: { findFirst: vi.fn(), create: vi.fn() }, numberSequence: { upsert: vi.fn() }, auditLog: { create: vi.fn() },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: database }));
import { createSchoolRecord } from "./service";
const actor = { id: "admin", role: "ADMIN" as const, status: "APPROVED" as const, permissions: [] };
const input = { name: "Student One", parentId: "parent", courseId: "course", enrollmentDate: "2026-09-24", paymentPlan: "ONE_TIME", fee: "25000", scholarship: "5000", discount: "0", billingDay: 1, dueDay: 10 };
beforeEach(() => {
  vi.resetAllMocks();
  database.$transaction.mockImplementation((operation: (transaction: typeof database) => unknown) => operation(database));
  database.parent.findUnique.mockResolvedValue({ id: "parent" });
  database.course.findFirst.mockResolvedValue({ id: "course" });
  database.student.findFirst.mockResolvedValue(null);
  database.student.create.mockResolvedValue({ id: "student" });
  database.numberSequence.upsert.mockResolvedValue({ value: 1 });
});
it.each(["STAFF", "PARENT"] as const)("denies %s without creation permission", async role => {
  await expect(createSchoolRecord({ ...actor, role }, "students", input)).rejects.toMatchObject({ status: 403 });
  expect(database.$transaction).not.toHaveBeenCalled();
});
it("atomically creates a numbered student and one-time enrollment", async () => {
  await createSchoolRecord(actor, "students", input);
  expect(database.student.create).toHaveBeenCalledWith({ data: expect.objectContaining({ studentCode: "FM-STU-2026-0001", parentId: "parent", enrollments: { create: expect.objectContaining({ paymentPlan: "ONE_TIME", fee: "25000", scholarship: "5000" }) } }) });
  expect(database.auditLog.create).toHaveBeenCalled();
});
it("rejects missing parents and wrong batches", async () => {
  database.parent.findUnique.mockResolvedValue(null);
  await expect(createSchoolRecord(actor, "students", input)).rejects.toMatchObject({ status: 400 });
  database.parent.findUnique.mockResolvedValue({ id: "parent" });
  database.batch.findFirst.mockResolvedValue(null);
  await expect(createSchoolRecord(actor, "students", { ...input, batchId: "wrong-course-batch" })).rejects.toMatchObject({ status: 400 });
  expect(database.student.create).not.toHaveBeenCalled();
});
it("rejects duplicate students before allocating numbers", async () => {
  database.student.findFirst.mockResolvedValue({ id: "existing" });
  await expect(createSchoolRecord(actor, "students", input)).rejects.toMatchObject({ status: 409 });
  expect(database.numberSequence.upsert).not.toHaveBeenCalled();
});