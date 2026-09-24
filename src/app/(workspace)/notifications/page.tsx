import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { currentUser } from "@/lib/auth/http";
import { can } from "@/lib/auth/policy";
import { db } from "@/lib/db";
import { reportPeriod } from "@/lib/reports/period";
import { clickToChat, reminderStage } from "@/lib/notifications/whatsapp";
import { CommandButton } from "@/components/command-button";
import { formatMoney } from "@/lib/billing/rules";
import { automationSettings } from "@/lib/automation/service";
import { collectionOverview } from "@/lib/billing/collections";
import { CollectionsPanel } from "@/components/collections-panel";
import { PaymentStatus } from "@/components/payment-status";
import { MessageCircle } from "lucide-react";
export default async function NotificationsPage() {
  const user = await currentUser(); if (!user || (user.role !== "PARENT" && !can(user, "notifications.view"))) redirect("/account");
  const today = reportPeriod({ period: "Today" }).to;
  const offsets = (await automationSettings()).reminderDays.split(",").map(Number);
  const canSeeInvoices = user.role === "PARENT" || can(user, "invoices.view");
  const overview = canSeeInvoices ? await collectionOverview(user) : null;
  const [invoices, resolutions, pending] = await Promise.all([
    canSeeInvoices ? db.invoice.findMany({ where: { cancelledAt: null, dueDate: { lte: new Date(today.getTime() + Math.max(...offsets) * 86400000) }, ...(user.role === "PARENT" ? { enrollment: { student: { parent: { userId: user.id } } } } : {}) }, include: { payments: true, enrollment: { include: { student: { include: { parent: true } } } } }, orderBy: { dueDate: "asc" } }) : [],
    db.reminderResolution.findMany({ where: { userId: user.id }, select: { key: true } }),
    user.role === "ADMIN" ? db.user.count({ where: { status: "PENDING" } }) : 0,
  ]);
  const notifications = invoices.flatMap(invoice => {
    const paid = invoice.payments.reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0)); const outstanding = invoice.total.minus(paid);
    const stage = reminderStage(invoice.dueDate, today, offsets); const key = `${invoice.id}:${stage}:${today.toISOString().slice(0, 10)}`;
    if (!stage || outstanding.lessThanOrEqualTo(0) || resolutions.some(record => record.key === `${user.id}:${key}`)) return [];
    let whatsapp = "";
    if (can(user, "whatsapp.send")) { try { whatsapp = clickToChat.compose(invoice.enrollment.student.parent.whatsapp || invoice.enrollment.student.parent.mobile, `Hello ${invoice.parentName},\n${invoice.studentName}'s Future Minds fee of INR ${outstanding.toFixed(2)} is due on ${invoice.dueDate.toISOString().slice(0, 10)}.\nInvoice: ${invoice.number}\nThank you, Future Minds`); } catch {} }
    return [{ invoice, outstanding, stage, key, whatsapp }];
  });
  return <><div className="page-heading"><div><p className="eyebrow">Future Minds / Follow-ups</p><h1>Notifications</h1></div></div>{pending > 0 && <p className="notice"><Link href="/users?status=PENDING">{pending} registrations pending approval</Link></p>}{overview && <CollectionsPanel rows={overview.rows} today={overview.today} canBill={can(user, "invoices.create")} canSend={can(user, "whatsapp.send")} />}
    <details className="inline-setup"><summary>Scheduled reminder tasks ({notifications.length})</summary>{notifications.map(note => <section className="data-section" key={note.key}><PaymentStatus dueDate={note.invoice.dueDate.toISOString().slice(0, 10)} today={today.toISOString().slice(0, 10)} settled={false} /><h2>{note.invoice.studentName}</h2><p>{formatMoney(note.outstanding)} · {note.invoice.courseName} · {note.invoice.dueDate.toISOString().slice(0, 10)}</p><div className="filter-bar"><Link className="secondary-button" href={`/invoices/${note.invoice.id}`}>View invoice</Link>{note.whatsapp && <a className="whatsapp-button" href={note.whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle size={17} />Remind parent</a>}{can(user, "notifications.view") && <CommandButton endpoint="/api/management/resolve" body={{ key: note.key }} label="Mark resolved" />}</div></section>)}{!notifications.length && <p className="empty-state">No scheduled reminder tasks.</p>}</details></>;
}