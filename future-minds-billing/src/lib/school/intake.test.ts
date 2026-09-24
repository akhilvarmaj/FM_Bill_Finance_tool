import { beforeEach, expect, it, vi } from "vitest";
const database = vi.hoisted(() => ({ $transaction: vi.fn(), $executeRaw: vi.fn(), course: { findFirst: vi.fn() }, batch: { findFirst: vi.fn() }, parent: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() }, student: { findFirst: vi.fn(), create: vi.fn() }, numberSequence: { upsert: vi.fn() }, auditLog: { create: vi.fn() } }));
vi.mock("server-only", () => ({})); vi.mock("@/lib/db", () => ({ db: database }));
import { billingIntake } from "./intake";
const admin = { id: "admin", role: "ADMIN" as const, status: "APPROVED" as const, permissions: [] };
const input = { parentId: "existing", student: { name: "Student One", courseId: "course", enrollmentDate: "2026-09-24", paymentPlan: "MONTHLY", fee: "100", scholarship: "0", discount: "0", billingDay: 1, dueDay: 10 } };
beforeEach(() => { vi.resetAllMocks(); database.$transaction.mockImplementation(operation => operation(database)); database.course.findFirst.mockResolvedValue({ id: "course" }); database.parent.findUnique.mockResolvedValue({ id: "existing" }); database.numberSequence.upsert.mockResolvedValue({ value: 1 }); database.student.create.mockResolvedValue({ id: "student", enrollments: [{ id: "enrollment" }] }); });
it("requires creation permissions before opening a transaction", async () => {
  await expect(billingIntake({ ...admin, role: "STAFF", permissions: ["invoices.create"] }, input)).rejects.toMatchObject({ status: 403 });
  expect(database.$transaction).not.toHaveBeenCalled();
});
it("creates an enrollment for the selected parent without creating a duplicate parent", async () => {
  expect(await billingIntake(admin, input)).toEqual({ enrollmentId: "enrollment" });
  expect(database.parent.create).not.toHaveBeenCalled();
  expect(database.student.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ parentId: "existing", studentCode: "FM-STU-2026-0001" }) }));
});
it("rejects duplicate students and invalid course selections", async () => {
  database.student.findFirst.mockResolvedValue({ id: "duplicate" });
  await expect(billingIntake(admin, input)).rejects.toMatchObject({ status: 409 });
  expect(database.student.create).not.toHaveBeenCalled();
  database.course.findFirst.mockResolvedValue(null);
  await expect(billingIntake(admin, input)).rejects.toMatchObject({ status: 400 });
});