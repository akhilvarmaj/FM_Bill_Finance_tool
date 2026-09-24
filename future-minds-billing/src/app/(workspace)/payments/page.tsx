import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/http";
import { can } from "@/lib/auth/policy";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/billing/rules";
export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await currentUser(); if (!user || (user.role !== "PARENT" && !can(user, "payments.view"))) redirect("/account");
  const page = Math.max(1, Math.min(10000, Math.floor(Number((await searchParams).page) || 1)));
  const records = await db.payment.findMany({ where: user.role === "PARENT" ? { invoice: { enrollment: { student: { parent: { userId: user.id } } } } } : {}, include: { invoice: { select: { id: true, number: true, studentName: true } } }, orderBy: { createdAt: "desc" }, take: 26, skip: (page - 1) * 25 });
  return <><h1>Payment History</h1><div className="table-scroll"><table><thead><tr><th>Date</th><th>Student</th><th>Invoice</th><th>Mode</th><th>Reference</th><th>Amount</th></tr></thead><tbody>{records.slice(0, 25).map(record => <tr key={record.id}><td>{record.paidAt.toISOString().slice(0, 10)}</td><td>{record.invoice.studentName}</td><td>{user.role === "PARENT" || can(user, "invoices.view") ? <Link href={`/invoices/${record.invoice.id}`}>{record.invoice.number}</Link> : record.invoice.number}</td><td>{record.mode}</td><td>{record.reference}</td><td>{formatMoney(record.amount)}</td></tr>)}</tbody></table></div>{!records.length && <p className="empty-state">No payments recorded.</p>}<div className="pagination">{page > 1 && <Link href={`?page=${page - 1}`}>Previous</Link>}<span>Page {page}</span>{records.length > 25 && <Link href={`?page=${page + 1}`}>Next</Link>}</div></>;
}