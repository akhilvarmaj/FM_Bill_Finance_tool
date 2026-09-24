import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import type { Principal } from "@/lib/auth/policy";
import { AuthError, requirePermission } from "@/lib/auth/service";
import { createInvoice } from "./service";
import { monthlySchedule } from "./schedule";
import { reportPeriod } from "@/lib/reports/period";
export async function generateMonthlyInvoices(actor: Principal | null) {
  const user = requirePermission(actor, "invoices.create");
  const enrollments = await db.enrollment.findMany({ where: { active: true, paymentPlan: "MONTHLY", student: { active: true } }, include: { course: true, invoices: { select: { periodKey: true } } } });
  const today = reportPeriod({ period: "Today" }).to.toISOString().slice(0, 10);
  let generated = 0; let remaining = false;
  for (const enrollment of enrollments) {
    for (const due of monthlySchedule(enrollment.enrollmentDate, enrollment.course.duration, enrollment.billingDay, enrollment.dueDay)) {
      if (due.invoiceDate > today || enrollment.invoices.some(invoice => invoice.periodKey === due.period)) continue;
      if (generated >= 20) { remaining = true; continue; }
      try {
        await createInvoice(user, { enrollmentId: enrollment.id, ...due, gross: enrollment.fee.toString(), scholarship: enrollment.scholarship.toString(), discount: enrollment.discount.toString(), paid: "0", mode: "UPI", reference: "", requestKey: randomUUID() });
        generated++;
      } catch (error) { if (!(error instanceof AuthError && error.status === 409)) throw error; }
    }
  }
  return { generated, remaining };
}