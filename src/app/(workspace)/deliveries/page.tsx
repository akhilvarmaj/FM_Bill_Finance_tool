import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/http";
import { can } from "@/lib/auth/policy";
import { db } from "@/lib/db";
import { CommandButton } from "@/components/command-button";
import { emailConfigured } from "@/lib/notifications/email";
export default async function DeliveriesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await currentUser(); if (!user || !can(user, "whatsapp.send") || !can(user, "invoices.view")) redirect("/account");
  const page = Math.max(1, Math.min(10000, Math.floor(Number((await searchParams).page) || 1)));
  const records = await db.deliveryAttempt.findMany({ include: { invoice: { select: { number: true } } }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 26, skip: (page - 1) * 25 });
  const labels = { QUEUED: "Queued", SENDING: "Sending", ACCEPTED: "Accepted by email server", FAILED: "Failed", UNKNOWN: "Unknown outcome", OPENED: "WhatsApp handoff (unconfirmed)" };
  return <><h1>Delivery History</h1><p className="muted">Email provider: {emailConfigured() ? "Configured" : "Not configured"}</p><div className="table-scroll"><table><thead><tr><th>Created</th><th>Invoice</th><th>Channel / Recipient</th><th>Status</th><th>Attempts</th><th>Action</th></tr></thead><tbody>{records.slice(0, 25).map(record => <tr key={record.id}><td>{record.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td><td><Link href={`/invoices/${record.invoiceId}`}>{record.invoice.number}</Link></td><td>{record.channel}<br />{record.recipient}</td><td>{labels[record.status]}{record.error && <p className="muted">{record.error}</p>}</td><td>{record.attempts}</td><td>{record.status === "FAILED" && record.attempts < 5 && <CommandButton endpoint={`/api/deliveries/${record.id}/retry`} label="Retry" confirm="Retry this failed email?" />}</td></tr>)}</tbody></table></div>{!records.length && <p className="empty-state">No delivery requests.</p>}<div className="pagination">{page > 1 && <Link href={`?page=${page - 1}`}>Previous</Link>}<span>Page {page}</span>{records.length > 25 && <Link href={`?page=${page + 1}`}>Next</Link>}</div></>;
}