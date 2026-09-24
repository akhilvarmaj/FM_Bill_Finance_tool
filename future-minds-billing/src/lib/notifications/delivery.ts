import "server-only";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { can, type Principal } from "@/lib/auth/policy";
import { AuthError, requirePermission } from "@/lib/auth/service";
import { accessibleInvoice } from "@/lib/billing/service";
import { invoicePdf } from "@/lib/billing/pdf";
import { instituteSettings } from "@/lib/management/service";
import { clickToChat, reminderStage } from "./whatsapp";
import { automationSettings } from "@/lib/automation/service";
import { scheduledHourReached } from "@/lib/automation/config";
import { reportPeriod } from "@/lib/reports/period";
import { deliveryFailureStatus, emailConfigured, sendInvoiceEmail } from "./email";
function invoiceMessage(invoice: Awaited<ReturnType<typeof accessibleInvoice>>, name: string) {
  const paid = invoice.payments.reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0));
  return `Hello ${invoice.parentName},\nInvoice ${invoice.number} for ${invoice.studentName}, ${invoice.courseName}.\nTotal: INR ${invoice.total.toFixed(2)}. Outstanding: INR ${invoice.total.minus(paid).toFixed(2)}.\nDue: ${invoice.dueDate.toISOString().slice(0, 10)}.\n${name}`;
}
export async function requestDelivery(actor: Principal | null, invoiceId: string, input: unknown) {
  const user = requirePermission(actor, "whatsapp.send");
  const data = z.object({ channel: z.enum(["EMAIL", "WHATSAPP"]), requestKey: z.string().min(1).max(200) }).strict().parse(input);
  const invoice = await accessibleInvoice(user, invoiceId);
  if (invoice.cancelledAt) throw new AuthError("Cancelled invoices cannot be sent.", 400);
  const institute = await instituteSettings(); const parent = invoice.enrollment.student.parent;
  const message = invoiceMessage(invoice, institute.name);
  const recipient = data.channel === "EMAIL" ? parent.email ?? "" : parent.whatsapp || parent.mobile;
  let href: string | undefined;
  if (data.channel === "EMAIL") {
    if (!emailConfigured()) throw new AuthError("Email is not configured. Add SMTP settings privately on the server.", 503);
    if (!z.email().safeParse(recipient).success) throw new AuthError("The parent needs a valid email address.", 400);
  } else {
    try { href = clickToChat.compose(recipient, message); } catch { throw new AuthError("The parent needs a valid WhatsApp number.", 400); }
  }
  const record = await db.$transaction(async transaction => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${data.requestKey}))`;
    const previous = await transaction.deliveryAttempt.findUnique({ where: { requestKey: data.requestKey } });
    if (previous) {
      if (previous.invoiceId !== invoiceId || previous.channel !== data.channel || previous.requestedById !== user.id) throw new AuthError("Delivery request already used.", 409);
      return previous;
    }
    const delivery = await transaction.deliveryAttempt.create({ data: { ...data, invoiceId, requestedById: user.id, recipient, message, status: data.channel === "EMAIL" ? "QUEUED" : "OPENED" } });
    await transaction.auditLog.create({ data: { actorId: user.id, action: data.channel === "EMAIL" ? "EMAIL_QUEUED" : "WHATSAPP_HANDOFF", entityId: invoiceId, details: { deliveryId: delivery.id } } });
    return delivery;
  });
  return { id: record.id, status: record.status, href };
}
export async function retryDelivery(actor: Principal | null, id: string) {
  const user = requirePermission(actor, "whatsapp.send");
  const record = await db.deliveryAttempt.findUnique({ where: { id } });
  if (!record) throw new AuthError("Delivery not found.", 404);
  await accessibleInvoice(user, record.invoiceId);
  return db.$transaction(async transaction => {
    const result = await transaction.deliveryAttempt.updateMany({ where: { id, status: "FAILED", channel: "EMAIL", attempts: { lt: 5 } }, data: { status: "QUEUED", error: null, availableAt: new Date(), requestedById: user.id } });
    if (!result.count) throw new AuthError("Only confirmed failed emails with fewer than five attempts can be retried.", 409);
    await transaction.auditLog.create({ data: { actorId: user.id, action: "DELIVERY_RETRIED", entityId: record.invoiceId, details: { deliveryId: id } } });
    return { ok: true };
  });
}
export async function processEmailQueue() {
  await db.deliveryAttempt.updateMany({ where: { status: "SENDING", updatedAt: { lt: new Date(Date.now() - 30 * 60000) } }, data: { status: "UNKNOWN", error: "Worker stopped before recording the outcome. Verify with the email provider before resending." } });
  if (!emailConfigured()) return { processed: 0, configured: false };
  const records = await db.deliveryAttempt.findMany({ where: { status: "QUEUED", channel: "EMAIL", availableAt: { lte: new Date() } }, orderBy: { createdAt: "asc" }, take: 5 });
  let processed = 0;
  for (const record of records) {
    const claim = await db.deliveryAttempt.updateMany({ where: { id: record.id, status: "QUEUED" }, data: { status: "SENDING", attempts: { increment: 1 } } });
    if (!claim.count) continue;
    let submitted = false;
    try {
      const account = await db.user.findUnique({ where: { id: record.requestedById }, include: { permissions: true } });
      if (!account) throw new Error("Sender unavailable.");
      const user = { id: account.id, role: account.roleName, status: account.status, permissions: account.permissions.map(permission => permission.permissionKey) };
      if (!can(user, "whatsapp.send")) throw new Error("Sender no longer authorized.");
      const invoice = await accessibleInvoice(user, record.invoiceId);
      if (invoice.cancelledAt || invoice.enrollment.student.parent.email !== record.recipient) throw new Error("Invoice or recipient changed.");
      if (record.requestKey.startsWith("reminder:") && invoice.payments.reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0)).greaterThanOrEqualTo(invoice.total)) throw new Error("Reminder already paid.");
      const institute = await instituteSettings();
      const pdf = await invoicePdf(invoice, institute);
      submitted = true;
      const providerId = await sendInvoiceEmail({ recipient: record.recipient, subject: invoice.number, message: invoiceMessage(invoice, institute.name), filename: `${invoice.number}.pdf`, pdf });
      await db.$transaction(async transaction => {
        await transaction.deliveryAttempt.update({ where: { id: record.id }, data: { status: "ACCEPTED", providerId, error: null } });
        await transaction.auditLog.create({ data: { actorId: record.requestedById, action: "EMAIL_ACCEPTED", entityId: record.invoiceId, details: { deliveryId: record.id } } });
      });
    } catch (error) {
      const status = submitted ? deliveryFailureStatus(error) : "FAILED";
      await db.deliveryAttempt.update({ where: { id: record.id }, data: { status, error: status === "UNKNOWN" ? "Provider outcome is unknown. Check provider logs before resending." : "Delivery failed. Check sender permissions, recipient and SMTP configuration." } });
    }
    processed++;
  }
  return { processed, configured: true };
}
export async function enqueueEmailReminders() {
  const settings = await automationSettings();
  if (!settings.emailReminders || !emailConfigured() || !scheduledHourReached(settings.hour)) return { queued: 0 };
  const account = await db.user.findUnique({ where: { id: settings.actorId } });
  if (!account || account.roleName !== "ADMIN" || account.status !== "APPROVED") return { queued: 0 };
  const today = reportPeriod({ period: "Today" }).to; const offsets = settings.reminderDays.split(",").map(Number);
  const invoices = await db.invoice.findMany({ where: { cancelledAt: null, dueDate: { lte: new Date(today.getTime() + Math.max(...offsets) * 86400000) } }, include: { payments: true }, orderBy: { dueDate: "asc" } });
  let queued = 0;
  for (const invoice of invoices) {
    if (queued >= 20) break;
    const stage = reminderStage(invoice.dueDate, today, offsets);
    if (!stage || invoice.payments.reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0)).greaterThanOrEqualTo(invoice.total)) continue;
    const requestKey = `reminder:${invoice.id}:${today.toISOString().slice(0, 10)}`;
    if (await db.deliveryAttempt.findUnique({ where: { requestKey } })) continue;
    try {
      await requestDelivery({ id: account.id, role: account.roleName, status: account.status, permissions: [] }, invoice.id, { channel: "EMAIL", requestKey });
      queued++;
    } catch (error) {
      if (!(error instanceof AuthError && error.status === 400)) throw error;
    }
  }
  return { queued };
}