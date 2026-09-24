import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { currentUser } from "@/lib/auth/http";
import { db } from "@/lib/db";
import { formatMoney, invoiceScope } from "@/lib/billing/rules";
import { PaymentStatus } from "@/components/payment-status";
import { reportPeriod } from "@/lib/reports/period";
import { can } from "@/lib/auth/policy";
export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const user = await currentUser(); let scope: Prisma.InvoiceWhereInput;
  const today = reportPeriod({ period: "Today" }).to.toISOString().slice(0, 10);
  try { scope = invoiceScope(user); } catch { redirect("/account"); }
  const params = await searchParams; const query = (params.q ?? "").slice(0, 100); const page = Math.max(1, Math.min(10000, Math.floor(Number(params.page) || 1)));
  const invoices = await db.invoice.findMany({ where: { AND: [scope, { OR: [{ number: { contains: query, mode: "insensitive" } }, { studentName: { contains: query, mode: "insensitive" } }, { studentCode: { contains: query, mode: "insensitive" } }, { courseName: { contains: query, mode: "insensitive" } }] }] }, include: { payments: true }, orderBy: { createdAt: "desc" }, take: 26, skip: (page - 1) * 25 });
  return <><div className="page-heading"><h1>Invoices</h1>{user && can(user, "invoices.create") && <Link className="primary-button" href="/billing">Create bill</Link>}</div><form className="filter-bar"><label className="field">Search<input name="q" defaultValue={query} placeholder="Invoice, student or course" /></label><button className="secondary-button">Search</button></form>
    <div className="table-scroll"><table><thead><tr><th>Invoice</th><th>Student / Course</th><th>Date</th><th>Total</th><th>Outstanding</th><th>Status</th></tr></thead><tbody>{invoices.slice(0, 25).map(invoice => { const paid = invoice.payments.reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0)); return <tr key={invoice.id}><td><Link href={`/invoices/${invoice.id}`}>{invoice.number}</Link></td><td>{invoice.studentName}<br />{invoice.courseName}</td><td>{invoice.invoiceDate.toISOString().slice(0, 10)}</td><td>{formatMoney(invoice.total)}</td><td>{formatMoney(invoice.cancelledAt ? 0 : invoice.total.minus(paid))}</td><td><PaymentStatus dueDate={invoice.dueDate.toISOString().slice(0, 10)} today={today} settled={paid.greaterThanOrEqualTo(invoice.total)} cancelled={!!invoice.cancelledAt} partial={paid.greaterThan(0)} /></td></tr>; })}</tbody></table></div>{!invoices.length && <p className="empty-state">No invoices found.</p>}
    <div className="pagination">{page > 1 && <Link href={`?q=${encodeURIComponent(query)}&page=${page - 1}`}>Previous</Link>}<span>Page {page}</span>{invoices.length > 25 && <Link href={`?q=${encodeURIComponent(query)}&page=${page + 1}`}>Next</Link>}</div></>;
}