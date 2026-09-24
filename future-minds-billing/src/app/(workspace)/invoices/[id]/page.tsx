import { notFound, redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { currentUser } from "@/lib/auth/http";
import { can } from "@/lib/auth/policy";
import { accessibleInvoice } from "@/lib/billing/service";
import { formatMoney } from "@/lib/billing/rules";
import { PaymentStatus } from "@/components/payment-status";
import { reportPeriod } from "@/lib/reports/period";
import { AuthError } from "@/lib/auth/service";
import { InvoiceActions } from "@/components/invoice-actions";
import { DeliveryActions } from "@/components/delivery-actions";
import { Download } from "lucide-react";
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser(); if (!user) redirect("/login");
  const invoice = await accessibleInvoice(user, (await params).id).catch(error => { if (error instanceof AuthError && [403, 404].includes(error.status)) notFound(); throw error; });
  const paid = invoice.payments.reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0));
  const outstanding = invoice.total.minus(paid);
  return <><p className="eyebrow">Future Minds · Robotics · AI · Coding</p><div className="page-heading"><h1>{invoice.number}</h1><PaymentStatus dueDate={invoice.dueDate.toISOString().slice(0, 10)} today={reportPeriod({ period: "Today" }).to.toISOString().slice(0, 10)} settled={paid.greaterThanOrEqualTo(invoice.total)} cancelled={!!invoice.cancelledAt} partial={paid.greaterThan(0)} /></div>
    <dl className="profile-details"><div><dt>Student</dt><dd>{invoice.studentName} ({invoice.studentCode})</dd></div><div><dt>Parent</dt><dd>{invoice.parentName}<br />{invoice.parentAddress}</dd></div><div><dt>Course</dt><dd>{invoice.courseName}</dd></div><div><dt>Plan / Period</dt><dd>{invoice.paymentPlan} / {invoice.periodKey}</dd></div><div><dt>Invoice date / Due</dt><dd>{invoice.invoiceDate.toISOString().slice(0, 10)} / {invoice.dueDate.toISOString().slice(0, 10)}</dd></div></dl>
    <div className="table-scroll"><table><thead><tr><th>Description</th><th>Amount</th></tr></thead><tbody>{invoice.items.map(item => <tr key={item.id}><td>{item.description}</td><td>{formatMoney(item.amount)}</td></tr>)}</tbody></table></div><p className="bill-total">Total <strong>{formatMoney(invoice.total)}</strong></p><p>Paid: {formatMoney(paid)} · Outstanding: {formatMoney(invoice.cancelledAt ? 0 : outstanding)}</p>
    {invoice.cancelledAt && <p className="notice error">Cancelled: {invoice.cancelReason} · {invoice.cancelledAt.toISOString().slice(0, 10)}</p>}
    <section className="data-section"><h2>Payment history</h2>{invoice.payments.length ? <div className="table-scroll"><table><thead><tr><th>Date</th><th>Mode</th><th>Reference</th><th>Amount</th></tr></thead><tbody>{invoice.payments.map(payment => <tr key={payment.id}><td>{payment.paidAt.toISOString().slice(0, 10)}</td><td>{payment.mode}</td><td>{payment.reference}</td><td>{formatMoney(payment.amount)}</td></tr>)}</tbody></table></div> : <p className="muted">No payments recorded.</p>}</section>
    <div className="stamp-area"><span>CENTER STAMP</span><div /><span>Authorized by Future Minds</span></div>
    <div className="filter-bar no-print"><a className="primary-button" href={`/api/invoices/${invoice.id}/pdf`}><Download size={17} />Download PDF</a></div>
    {!invoice.cancelledAt && can(user, "whatsapp.send") && <DeliveryActions invoiceId={invoice.id} />}
    <InvoiceActions id={invoice.id} outstanding={outstanding.toString()} pay={!invoice.cancelledAt && outstanding.greaterThan(0) && can(user, "payments.create")} cancel={!invoice.cancelledAt && can(user, "invoices.cancel")} />
  </>;
}