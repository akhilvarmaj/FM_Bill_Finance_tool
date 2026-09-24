import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { AuthError, requirePermission } from "@/lib/auth/service";
import { type Principal } from "@/lib/auth/policy";
import { amounts, invoiceInput, invoiceScope, paymentInput } from "./rules";
import { instituteSchema } from "@/lib/management/config";
import { monthlySchedule } from "./schedule";

export async function accessibleInvoice(user: Principal | null, id: string) {
  let scope: Prisma.InvoiceWhereInput;
  try { scope = invoiceScope(user); } catch { throw new AuthError("You do not have permission to view invoices.", user ? 403 : 401); }
  const invoice = await db.invoice.findFirst({ where: { AND: [scope, { id }] }, include: { items: true, payments: { orderBy: { paidAt: "asc" } }, enrollment: { include: { student: { include: { parent: true } } } } } });
  if (!invoice) throw new AuthError("Invoice not found.", 404);
  return invoice;
}

export async function createInvoice(actor: Principal | null, input: unknown) {
  const user = requirePermission(actor, "invoices.create");
  const data = invoiceInput.parse(input);
  let calculated: ReturnType<typeof amounts>;
  try { calculated = amounts(data.gross, data.scholarship, data.discount, data.paid); } catch { throw new AuthError("Scholarship, discount or payment exceeds the fee.", 400); }
  if (calculated.paid.greaterThan(0)) requirePermission(user, "payments.create");
  return db.$transaction(async transaction => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${data.enrollmentId}))`;
    const enrollment = await transaction.enrollment.findUnique({ where: { id: data.enrollmentId }, include: { student: { include: { parent: true } }, course: true } });
    if (!enrollment || !enrollment.active || !enrollment.student.active) throw new AuthError("Select an active student enrollment before billing.", 400);
    const periodKey = enrollment.paymentPlan === "MONTHLY" ? data.period : "ONE_TIME";
    if (data.invoiceDate < enrollment.enrollmentDate.toISOString().slice(0, 10)) throw new AuthError("Invoice date cannot precede enrollment.", 400);
    if (enrollment.paymentPlan === "MONTHLY" && !monthlySchedule(enrollment.enrollmentDate, enrollment.course.duration, enrollment.billingDay, enrollment.dueDay).some(due => due.period === data.period)) throw new AuthError("Billing period must fall within the course term.", 400);
    const activeKey = `${enrollment.id}:${periodKey}`;
    if (await transaction.invoice.findUnique({ where: { activeKey } })) throw new AuthError("This invoice has already been generated.", 409);
    const year = data.invoiceDate.slice(0, 4);
    const settings = instituteSchema.parse((await transaction.systemSetting.findUnique({ where: { key: "institute" } }))?.value ?? {});
    const sequence = await transaction.numberSequence.upsert({ where: { key: `invoice-${year}` }, create: { key: `invoice-${year}`, value: 1 }, update: { value: { increment: 1 } } });
    const parent = enrollment.student.parent;
    const invoice = await transaction.invoice.create({ data: {
      number: `${settings.invoicePrefix}-${year}-${String(sequence.value).padStart(4, "0")}`, enrollmentId: enrollment.id, periodKey, activeKey,
      studentName: enrollment.student.name, studentCode: enrollment.student.studentCode, parentName: parent.name,
      parentAddress: [parent.address, parent.city, parent.state, parent.pincode].filter(Boolean).join(", "), courseName: enrollment.course.name,
      paymentPlan: enrollment.paymentPlan, gross: data.gross, scholarship: data.scholarship, discount: data.discount, total: calculated.total,
      invoiceDate: new Date(data.invoiceDate), dueDate: new Date(data.dueDate), createdById: user.id,
      items: { create: [{ description: enrollment.course.name, amount: data.gross }, { description: "Scholarship", amount: new Prisma.Decimal(data.scholarship).negated() }, { description: "Discount", amount: new Prisma.Decimal(data.discount).negated() }] },
      ...(calculated.paid.greaterThan(0) ? { payments: { create: { requestKey: data.requestKey, amount: calculated.paid, mode: data.mode, reference: data.reference, paidAt: new Date(data.invoiceDate), recordedById: user.id } } } : {}),
    } });
    await transaction.auditLog.create({ data: { actorId: user.id, action: "INVOICE_CREATED", entityId: invoice.id, details: { number: invoice.number, total: invoice.total.toString() } } });
    if (calculated.paid.greaterThan(0)) await transaction.auditLog.create({ data: { actorId: user.id, action: "PAYMENT_RECORDED", entityId: invoice.id, details: { amount: calculated.paid.toString(), mode: data.mode } } });
    return { id: invoice.id };
  }, { timeout: 15000 });
}

export async function recordPayment(actor: Principal | null, id: string, input: unknown) {
  const user = requirePermission(actor, "payments.create"); const data = paymentInput.parse(input);
  if (new Prisma.Decimal(data.amount).lessThanOrEqualTo(0)) throw new AuthError("Enter an amount greater than zero.", 400);
  return db.$transaction(async transaction => {
    await transaction.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${id} FOR UPDATE`;
    const prior = await transaction.payment.findUnique({ where: { requestKey: data.requestKey } });
    if (prior) {
      if (prior.invoiceId !== id || !prior.amount.equals(data.amount) || prior.mode !== data.mode || (prior.reference ?? "") !== data.reference || prior.paidAt.toISOString().slice(0, 10) !== data.paidAt) throw new AuthError("Payment request already used with different details.", 409);
      return { id: prior.id };
    }
    const invoice = await transaction.invoice.findUnique({ where: { id }, include: { payments: true } });
    if (!invoice) throw new AuthError("Invoice not found.", 404);
    if (invoice.cancelledAt) throw new AuthError("Cannot pay a cancelled invoice.", 400);
    const paid = invoice.payments.reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0));
    if (paid.plus(data.amount).greaterThan(invoice.total)) throw new AuthError("Payment exceeds the outstanding amount.", 400);
    if (data.paidAt < invoice.invoiceDate.toISOString().slice(0, 10)) throw new AuthError("Payment date cannot precede the invoice.", 400);
    const payment = await transaction.payment.create({ data: { invoiceId: id, amount: data.amount, mode: data.mode, reference: data.reference, paidAt: new Date(data.paidAt), requestKey: data.requestKey, recordedById: user.id } });
    await transaction.auditLog.create({ data: { actorId: user.id, action: "PAYMENT_RECORDED", entityId: id, details: { paymentId: payment.id, amount: data.amount, mode: data.mode } } });
    return { id: payment.id };
  }, { timeout: 15000 });
}

export async function cancelInvoice(actor: Principal | null, id: string, input: unknown) {
  const user = requirePermission(actor, "invoices.cancel");
  const { reason } = z.object({ reason: z.string().trim().min(3).max(500) }).strict().parse(input);
  return db.$transaction(async transaction => {
    await transaction.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${id} FOR UPDATE`;
    const invoice = await transaction.invoice.findUnique({ where: { id }, include: { _count: { select: { payments: true } } } });
    if (!invoice) throw new AuthError("Invoice not found.", 404);
    if (invoice.cancelledAt) throw new AuthError("Invoice already cancelled.", 409);
    if (invoice._count.payments) throw new AuthError("Invoices with payments require a refund workflow and cannot be cancelled here.", 400);
    await transaction.invoice.update({ where: { id }, data: { activeKey: null, cancelledAt: new Date(), cancelledById: user.id, cancelReason: reason } });
    await transaction.auditLog.create({ data: { actorId: user.id, action: "INVOICE_CANCELLED", entityId: id, details: { reason } } });
    return { ok: true };
  });
}