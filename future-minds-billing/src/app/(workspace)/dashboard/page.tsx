import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, Plus, Wallet, CalendarDays, CircleAlert, ArrowDownLeft } from "lucide-react";
import { currentUser } from "@/lib/auth/http";
import { can } from "@/lib/auth/policy";
import { db } from "@/lib/db";
import { collectionOverview } from "@/lib/billing/collections";
import { CollectionsPanel } from "@/components/collections-panel";
import { formatMoney } from "@/lib/billing/rules";
import { reportPeriod } from "@/lib/reports/period";

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!can(user, "dashboard.view")) redirect("/account");
  const range = reportPeriod({ period: "This Month" });
  const [collections, received, pending] = await Promise.all([
    can(user, "invoices.view") ? collectionOverview(user) : null,
    can(user, "payments.view") || can(user, "reports.sales") ? db.payment.aggregate({ where: { paidAt: { gte: range.from, lte: range.to } }, _sum: { amount: true } }) : null,
    user.role === "ADMIN" ? db.user.count({ where: { status: "PENDING" } }) : 0,
  ]);
  return <div className="dashboard-view"><div className="page-heading dashboard-heading"><div><p className="eyebrow">Future Minds / Overview</p><h1>Your billing, at a glance.</h1><p className="muted">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" })}</p></div>{can(user, "invoices.create") && <Link className="primary-button" href="/billing"><Plus size={18} />Create bill</Link>}</div>
    <div className="finance-metrics">{[
      ...(received ? [{ label: "Collected this month", amount: received._sum.amount?.toString() ?? "0", detail: "Payments received", tone: "success", Icon: ArrowDownLeft }] : []),
      ...(collections ? [{ label: "Due in the next 7 days", amount: collections.week, detail: "Invoiced + scheduled fees", tone: "info", Icon: CalendarDays }, { label: "Overdue", amount: collections.overdue, detail: "Needs a follow-up", tone: "danger", Icon: CircleAlert }, { label: "Total outstanding", amount: collections.outstanding, detail: "Issued invoices only", tone: "neutral", Icon: Wallet }] : []),
    ].map(item => <div className={`finance-metric tone-${item.tone}`} key={item.label}><div><span>{item.label}</span><item.Icon size={19} /></div><strong>{formatMoney(item.amount)}</strong><small>{item.detail}</small></div>)}</div>
    {collections ? <CollectionsPanel rows={collections.rows} today={collections.today} canBill={can(user, "invoices.create")} canSend={can(user, "whatsapp.send")} /> : <p className="empty-state">Invoice access is needed to view collections.</p>}
    <footer className="dashboard-footer">{can(user, "reports.sales") && <Link href="/reports">View financial reports <ArrowUpRight size={16} /></Link>}{pending > 0 && <Link href="/users?status=PENDING"><span className="notification-dot" />{pending} accounts awaiting approval <ArrowUpRight size={16} /></Link>}</footer>
  </div>;
}