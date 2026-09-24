import { expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { amounts, invoiceScope, invoiceStatus } from "./rules";
it("calculates scholarships, discounts and partial payments precisely", () => {
  const result = amounts("25000", "5000", "0", "10000");
  expect(result.total.toString()).toBe("20000"); expect(result.outstanding.toString()).toBe("10000");
  expect(amounts("0.30", "0.10", "0.10").total.toString()).toBe("0.1");
});
it("rejects overpayment and excessive reductions", () => {
  expect(() => amounts("100", "50", "51")).toThrow();
  expect(() => amounts("100", "0", "0", "101")).toThrow();
});
it("derives payment status from records", () => {
  expect(invoiceStatus(new Prisma.Decimal(100), new Prisma.Decimal(0), false)).toBe("UNPAID");
  expect(invoiceStatus(new Prisma.Decimal(100), new Prisma.Decimal(25), false)).toBe("PARTIALLY PAID");
  expect(invoiceStatus(new Prisma.Decimal(100), new Prisma.Decimal(100), false)).toBe("PAID");
  expect(invoiceStatus(new Prisma.Decimal(100), new Prisma.Decimal(0), true)).toBe("CANCELLED");
});
it("always scopes parent invoices by authenticated ownership", () => {
  expect(invoiceScope({ id: "parent-a", role: "PARENT", status: "APPROVED", permissions: ["invoices.view"] })).toEqual({ enrollment: { student: { parent: { userId: "parent-a" } } } });
  expect(() => invoiceScope({ id: "staff", role: "STAFF", status: "APPROVED", permissions: [] })).toThrow();
  expect(() => invoiceScope(null)).toThrow();
});