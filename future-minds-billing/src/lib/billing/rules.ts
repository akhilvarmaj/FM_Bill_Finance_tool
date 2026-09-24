import { Prisma } from "@prisma/client";
import { z } from "zod";
import { money } from "@/lib/school/validation";
import type { Principal } from "@/lib/auth/policy";
import { can } from "@/lib/auth/policy";

export const paymentModes = ["UPI", "CASH", "CREDIT_CARD", "DEBIT_CARD"] as const;
export const invoiceInput = z.object({
  enrollmentId: z.string().min(1, "Please select a student enrollment."),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  invoiceDate: z.iso.date(), dueDate: z.iso.date(),
  gross: money, scholarship: money, discount: money,
  paid: money, mode: z.enum(paymentModes), reference: z.string().trim().max(150).default(""),
  requestKey: z.uuid(),
}).strict().refine(data => data.dueDate >= data.invoiceDate, "Due date must be on or after invoice date.");
export const paymentInput = z.object({ amount: money, mode: z.enum(paymentModes), reference: z.string().trim().max(150).default(""), paidAt: z.iso.date(), requestKey: z.uuid() }).strict();

export function amounts(gross: string, scholarship: string, discount: string, paid = "0") {
  const total = new Prisma.Decimal(gross).minus(scholarship).minus(discount);
  const payment = new Prisma.Decimal(paid);
  if (total.isNegative() || payment.isNegative() || payment.greaterThan(total)) throw new Error("Discounts or payment exceed the invoice amount.");
  return { total, paid: payment, outstanding: total.minus(payment) };
}

export function invoiceStatus(total: Prisma.Decimal, paid: Prisma.Decimal, cancelled: boolean) {
  return cancelled ? "CANCELLED" : paid.greaterThanOrEqualTo(total) ? "PAID" : paid.greaterThan(0) ? "PARTIALLY PAID" : "UNPAID";
}

export function invoiceScope(user: Principal | null): Prisma.InvoiceWhereInput {
  if (!user || user.status !== "APPROVED") throw new Error("Unauthenticated");
  if (user.role === "PARENT") return { enrollment: { student: { parent: { userId: user.id } } } };
  if (!can(user, "invoices.view")) throw new Error("Forbidden");
  return {};
}

export function formatMoney(value: Prisma.Decimal | string | number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(value));
}