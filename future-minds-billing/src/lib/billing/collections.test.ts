import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const database = vi.hoisted(() => ({ invoice: { findMany: vi.fn() }, enrollment: { findMany: vi.fn() } }));
vi.mock("server-only", () => ({})); vi.mock("@/lib/db", () => ({ db: database }));
vi.mock("@/lib/reports/period", () => ({ reportPeriod: () => ({ to: new Date("2026-09-24") }) }));
import { collectionOverview } from "./collections";
const parent = { name: "Parent One", mobile: "9876543210", whatsapp: null };
const actor = { id: "admin", role: "ADMIN" as const, status: "APPROVED" as const, permissions: [] };
beforeEach(() => {
  vi.clearAllMocks();
  database.invoice.findMany.mockResolvedValue([{ id: "invoice", enrollmentId: "enrollment", periodKey: "2026-09", studentName: "Student One", courseName: "Robotics", number: "FM-1", dueDate: new Date("2026-09-30"), total: new Prisma.Decimal(100), payments: [{ amount: new Prisma.Decimal(25) }], enrollment: { student: { parent } } }]);
  database.enrollment.findMany.mockResolvedValue([]);
});
it("shows next-week partial balances and recipient-specific WhatsApp reminders", async () => {
  const result = await collectionOverview(actor);
  expect(result.week).toBe("75.00"); expect(result.rows[0].status).toBe("week");
  expect(result.rows[0].whatsapp).toContain("https://wa.me/919876543210");
  expect(decodeURIComponent(result.rows[0].whatsapp!)).toContain("Outstanding: INR 75.00");
});
it("includes next-week unbilled monthly fees without inflating invoiced outstanding", async () => {
  database.enrollment.findMany.mockResolvedValue([{ id: "new", enrollmentDate: new Date("2026-09-01"), billingDay: 1, dueDay: 28, course: { name: "Coding", duration: 1 }, student: { name: "Student Two", parent }, fee: new Prisma.Decimal(200), scholarship: new Prisma.Decimal(20), discount: new Prisma.Decimal(0), invoices: [] }]);
  const result = await collectionOverview(actor);
  expect(result.week).toBe("255.00"); expect(result.outstanding).toBe("75.00");
  expect(result.rows.find(row => row.enrollmentId === "new")?.number).toBe("Not billed");
});
it("scopes parent queries and omits staff-only sending actions", async () => {
  const result = await collectionOverview({ ...actor, role: "PARENT", id: "parent-account" });
  expect(database.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { AND: [{ enrollment: { student: { parent: { userId: "parent-account" } } } }, { cancelledAt: null }] } }));
  expect(result.rows[0].whatsapp).toBeUndefined();
});