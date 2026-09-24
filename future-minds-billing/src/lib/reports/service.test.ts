import { expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const database = vi.hoisted(() => ({ $transaction: vi.fn(), invoice: { findMany: vi.fn() }, payment: { findMany: vi.fn() }, marketingExpense: { aggregate: vi.fn() }, student: { count: vi.fn() }, monthlyTarget: { findMany: vi.fn() } }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: database }));
import { salesReport } from "./service";
it("reconciles exact sales, balances, plan totals and zero-sales months", async () => {
  const decimal = (value: string) => new Prisma.Decimal(value);
  database.$transaction.mockResolvedValue([
    ["0.10", "0.20"].map(total => ({ total: decimal(total), invoiceDate: new Date("2026-01-10"), payments: [{ amount: decimal("0.05") }], enrollment: { courseId: "course", studentId: "same-student" }, courseName: "Robotics" })),
    [{ amount: decimal("0.05"), mode: "UPI", invoice: { paymentPlan: "MONTHLY" } }, { amount: decimal("0.05"), mode: "CASH", invoice: { paymentPlan: "ONE_TIME" } }],
    { _sum: { amount: decimal("0.03") } }, 1, [{ amount: decimal("0.60") }],
  ]);
  const report = await salesReport({ period: "Custom", from: "2026-01-01", to: "2026-02-28" });
  expect(report.sales.toString()).toBe("0.3"); expect(report.outstanding.toString()).toBe("0.2");
  expect(report.collected.toString()).toBe("0.1"); expect(report.oneTime.toString()).toBe("0.05");
  expect(report.achievement).toBe(50); expect(report.spendPercent).toBe(10);
  expect(report.courses[0]).toEqual({ name: "Robotics", revenue: "0.30", students: 1, average: "0.30" });
  expect(report.monthly).toEqual([{ name: "2026-01", amount: 0.3 }, { name: "2026-02", amount: 0 }]);
});