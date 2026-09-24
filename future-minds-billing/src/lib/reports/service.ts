import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { reportPeriod } from "./period";
export async function salesReport(input: { period?: string; from?: string; to?: string; year?: string }) {
  const range = reportPeriod(input); const date = { gte: range.from, lte: range.to };
  const [invoices, payments, marketing, students, targets] = await db.$transaction([
    db.invoice.findMany({ where: { cancelledAt: null, invoiceDate: date }, include: { payments: true, enrollment: { select: { courseId: true, studentId: true } } } }),
    db.payment.findMany({ where: { paidAt: date }, include: { invoice: { select: { paymentPlan: true } } } }),
    db.marketingExpense.aggregate({ where: { date }, _sum: { amount: true } }),
    db.student.count({ where: { enrollments: { some: { enrollmentDate: date } } } }),
    db.monthlyTarget.findMany({ where: { month: { gte: range.from.toISOString().slice(0, 7), lte: range.to.toISOString().slice(0, 7) } } }),
  ]);
  let sales = new Prisma.Decimal(0); let outstanding = new Prisma.Decimal(0);
  const monthly: Record<string, Prisma.Decimal> = {}; const courses: Record<string, { name: string; revenue: Prisma.Decimal; students: Set<string> }> = {};
  for (let month = new Date(Date.UTC(range.from.getUTCFullYear(), range.from.getUTCMonth(), 1)); month <= range.to; month = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1))) monthly[month.toISOString().slice(0, 7)] = new Prisma.Decimal(0);
  for (const invoice of invoices) {
    sales = sales.plus(invoice.total);
    const paid = invoice.payments.reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0));
    outstanding = outstanding.plus(invoice.total.minus(paid));
    const key = invoice.invoiceDate.toISOString().slice(0, 7); monthly[key] = (monthly[key] ?? new Prisma.Decimal(0)).plus(invoice.total);
    const course = courses[invoice.enrollment.courseId] ??= { name: invoice.courseName, revenue: new Prisma.Decimal(0), students: new Set() };
    course.revenue = course.revenue.plus(invoice.total); course.students.add(invoice.enrollment.studentId);
  }
  const collected = payments.reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0));
  const recurring = payments.filter(payment => payment.invoice.paymentPlan === "MONTHLY").reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0));
  const methods = ["UPI", "CASH", "CREDIT_CARD", "DEBIT_CARD"].map(mode => ({ mode, count: payments.filter(payment => payment.mode === mode).length, amount: payments.filter(payment => payment.mode === mode).reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0)).toString() }));
  const spend = marketing._sum.amount ?? new Prisma.Decimal(0); const target = targets.reduce((sum, entry) => sum.plus(entry.amount), new Prisma.Decimal(0));
  return { range, sales, outstanding, students, collected, recurring, oneTime: collected.minus(recurring), spend, target, achievement: target.isZero() ? 0 : sales.div(target).mul(100).toNumber(), spendPercent: sales.isZero() ? 0 : spend.div(sales).mul(100).toNumber(), count: invoices.length, average: invoices.length ? sales.div(invoices.length) : new Prisma.Decimal(0), methods, monthly: Object.entries(monthly).sort().map(([name, amount]) => ({ name, amount: amount.toNumber() })), courses: Object.values(courses).map(course => ({ name: course.name, revenue: course.revenue.toFixed(2), students: course.students.size, average: course.students.size ? course.revenue.div(course.students.size).toFixed(2) : "0.00" })) };
}