import { redirect } from "next/navigation";
import Link from "next/link";
import { reportPeriod } from "@/lib/reports/period";
import { currentUser } from "@/lib/auth/http";
import { can } from "@/lib/auth/policy";
import { db } from "@/lib/db";
import { RecordForm } from "@/components/record-form";
import { marketingCategories } from "@/lib/management/config";
import { formatMoney, paymentModes } from "@/lib/billing/rules";
export default async function MarketingPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; page?: string }> }) {
  const user = await currentUser(); if (!user || !can(user, "marketing.view")) redirect("/account");
  const params = await searchParams; const today = new Date().toISOString().slice(0, 10);
  const range = reportPeriod({ ...params, period: "Custom" });
  const from = range.from.toISOString().slice(0, 10); const to = range.to.toISOString().slice(0, 10);
  const page = Math.max(1, Math.min(10000, Math.floor(Number(params.page) || 1)));
  const records = await db.marketingExpense.findMany({ where: { date: { gte: range.from, lte: range.to } }, orderBy: [{ date: "desc" }, { id: "asc" }], take: 26, skip: (page - 1) * 25 });
  return <><h1>Marketing Expenses</h1><form className="filter-bar"><label className="field">From<input type="date" name="from" defaultValue={from} /></label><label className="field">To<input type="date" name="to" defaultValue={to} /></label><button className="secondary-button">Apply</button></form><div className="table-scroll"><table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Mode</th><th>Amount</th></tr></thead><tbody>{records.slice(0, 25).map(record => <tr key={record.id}><td>{record.date.toISOString().slice(0, 10)}</td><td>{record.category}</td><td>{record.description}</td><td>{record.mode}</td><td>{formatMoney(record.amount)}</td></tr>)}</tbody></table></div>{!records.length && <p className="empty-state">No marketing expenses recorded.</p>}
    <div className="pagination">{page > 1 && <Link href={`?from=${from}&to=${to}&page=${page - 1}`}>Previous</Link>}<span>Page {page}</span>{records.length > 25 && <Link href={`?from=${from}&to=${to}&page=${page + 1}`}>Next</Link>}</div>
    {can(user, "marketing.create") && <section className="data-section"><h2>Add expense</h2><RecordForm kind="marketing" endpoint="/api/management/marketing" destination="/marketing" fields={[
      { name: "date", label: "Date", type: "date", value: today, required: true }, { name: "category", label: "Category", required: true, options: marketingCategories.map(value => ({ value, label: value })) },
      { name: "description", label: "Description", required: true }, { name: "amount", label: "Amount (INR)", type: "number", required: true }, { name: "mode", label: "Payment mode", required: true, options: paymentModes.map(value => ({ value, label: value })) }, { name: "notes", label: "Notes" },
    ]} /></section>}</>;
}