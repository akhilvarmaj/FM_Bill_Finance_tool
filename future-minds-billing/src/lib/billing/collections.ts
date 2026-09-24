import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { can, type Principal } from "@/lib/auth/policy";
import { invoiceScope } from "./rules";
import { collectionStatus } from "./status";
import { monthlySchedule } from "./schedule";
import { reportPeriod } from "@/lib/reports/period";
import { clickToChat } from "@/lib/notifications/whatsapp";
export type CollectionRow = { id: string; student: string; parent: string; course: string; number: string; dueDate: string; amount: string; settled: boolean; partial: boolean; status: string; invoiceId?: string; enrollmentId: string; period: string; whatsapp?: string; phone: string };
export async function collectionOverview(user: Principal) {
  const today = reportPeriod({ period: "Today" }).to.toISOString().slice(0, 10);
  const scope = invoiceScope(user);
  const [invoices, enrollments] = await Promise.all([
    db.invoice.findMany({ where: { AND: [scope, { cancelledAt: null }] }, include: { payments: true, enrollment: { include: { student: { include: { parent: true } } } } }, orderBy: [{ dueDate: "asc" }, { id: "asc" }] }),
    db.enrollment.findMany({ where: { active: true, paymentPlan: "MONTHLY", student: { active: true, ...(user.role === "PARENT" ? { parent: { userId: user.id } } : {}) } }, include: { student: { include: { parent: true } }, course: true, invoices: { select: { periodKey: true } } } }),
  ]);
  const rows: CollectionRow[] = [];
  let outstanding = new Prisma.Decimal(0); let overdue = new Prisma.Decimal(0); let week = new Prisma.Decimal(0);
  for (const invoice of invoices) {
    const paid = invoice.payments.reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0));
    const amount = invoice.total.minus(paid); const dueDate = invoice.dueDate.toISOString().slice(0, 10);
    const status = collectionStatus(dueDate, today, amount.lessThanOrEqualTo(0));
    outstanding = outstanding.plus(amount);
    if (status.key === "overdue") overdue = overdue.plus(amount);
    if (status.key === "week" || status.key === "today") week = week.plus(amount);
    const parent = invoice.enrollment.student.parent;
    rows.push({ id: invoice.id, invoiceId: invoice.id, enrollmentId: invoice.enrollmentId, period: invoice.periodKey, student: invoice.studentName, parent: parent.name, course: invoice.courseName, number: invoice.number, dueDate, amount: (status.key === "paid" ? invoice.total : amount).toFixed(2), settled: status.key === "paid", partial: paid.greaterThan(0), status: status.key, phone: parent.whatsapp || parent.mobile });
  }
  for (const enrollment of enrollments) {
    for (const due of monthlySchedule(enrollment.enrollmentDate, enrollment.course.duration, enrollment.billingDay, enrollment.dueDay)) {
      const status = collectionStatus(due.dueDate, today, false);
      if (!["week", "today"].includes(status.key) || enrollment.invoices.some(invoice => invoice.periodKey === due.period)) continue;
      const amount = enrollment.fee.minus(enrollment.scholarship).minus(enrollment.discount);
      if (amount.lessThanOrEqualTo(0)) continue;
      week = week.plus(amount);
      const parent = enrollment.student.parent;
      rows.push({ id: `${enrollment.id}:${due.period}`, enrollmentId: enrollment.id, period: due.period, student: enrollment.student.name, parent: parent.name, course: enrollment.course.name, number: "Not billed", dueDate: due.dueDate, amount: amount.toFixed(2), settled: false, partial: false, status: status.key, phone: parent.whatsapp || parent.mobile });
    }
  }
  for (const row of rows) {
    if (row.settled || !can(user, "whatsapp.send")) continue;
    try { row.whatsapp = clickToChat.compose(row.phone, `Hello ${row.parent},\nA fee reminder for ${row.student} - ${row.course}.\n${row.invoiceId ? `Invoice: ${row.number}\nOutstanding` : `Upcoming fee (${row.period})`}: INR ${row.amount}\nDue date: ${row.dueDate}\nThank you, Future Minds`); } catch { row.whatsapp = undefined; }
  }
  return { today, rows: rows.sort((first, second) => first.dueDate.localeCompare(second.dueDate)), outstanding: outstanding.toFixed(2), overdue: overdue.toFixed(2), week: week.toFixed(2) };
}