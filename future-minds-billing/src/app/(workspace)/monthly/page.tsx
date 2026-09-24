import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/http";
import { can } from "@/lib/auth/policy";
import { db } from "@/lib/db";
import { monthlySchedule } from "@/lib/billing/schedule";
import { formatMoney } from "@/lib/billing/rules";
import { CommandButton } from "@/components/command-button";
export default async function MonthlyPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await currentUser(); if (!user || (user.role !== "PARENT" && !can(user, "invoices.view"))) redirect("/account");
  const page = Math.max(1, Math.min(10000, Math.floor(Number((await searchParams).page) || 1)));
  const records = await db.enrollment.findMany({ where: { active: true, paymentPlan: "MONTHLY", ...(user.role === "PARENT" ? { student: { parent: { userId: user.id } } } : {}) }, include: { course: true, student: true, invoices: { select: { id: true, periodKey: true, cancelledAt: true } } }, orderBy: [{ enrollmentDate: "desc" }, { id: "asc" }], take: 26, skip: (page - 1) * 25 });
  return <><div className="page-heading"><h1>Monthly Dues</h1>{can(user, "invoices.create") && <CommandButton endpoint="/api/monthly" label="Generate due invoices" confirm="Generate unpaid invoices for elapsed billing dates? Existing periods will be skipped." />}</div><div className="table-scroll"><table><thead><tr><th>Student / Course</th><th>Month</th><th>Fee</th><th>Due date</th><th>Invoice</th></tr></thead><tbody>{records.slice(0, 25).flatMap(record => monthlySchedule(record.enrollmentDate, record.course.duration, record.billingDay, record.dueDay).map(due => {
    const invoice = record.invoices.find(value => value.periodKey === due.period && !value.cancelledAt);
    return <tr key={`${record.id}:${due.period}`}><td>{record.student.name}<br />{record.course.name}</td><td>{due.period}</td><td>{formatMoney(record.fee.minus(record.scholarship).minus(record.discount))}</td><td>{due.dueDate}</td><td>{invoice ? <Link href={`/invoices/${invoice.id}`}>View invoice</Link> : "Not billed"}</td></tr>;
  }))}</tbody></table></div>{!records.length && <p className="empty-state">No active monthly enrollments.</p>}<div className="pagination">{page > 1 && <Link href={`?page=${page - 1}`}>Previous</Link>}<span>Page {page}</span>{records.length > 25 && <Link href={`?page=${page + 1}`}>Next</Link>}</div></>;
}