import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/http";
import { db } from "@/lib/db";

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  if ((await currentUser())?.role !== "ADMIN") redirect("/account");
  const page = Math.max(1, Math.min(10000, Math.floor(Number((await searchParams).page) || 1)));
  const entries = await db.auditLog.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 50, take: 51, include: { actor: { select: { name: true } } } });
  return <><p className="eyebrow">Administration</p><h1>Audit Logs</h1><div className="table-scroll"><table><thead><tr><th>Date</th><th>User</th><th>Action</th><th>Record</th><th>Details</th></tr></thead><tbody>{entries.slice(0, 50).map(entry => <tr key={entry.id}><td>{entry.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td><td>{entry.actor?.name ?? "System"}</td><td>{entry.action.replaceAll("_", " ")}</td><td>{entry.entityId}</td><td>{entry.details && <details><summary>View</summary><pre className="audit-detail">{JSON.stringify(entry.details, null, 2)}</pre></details>}</td></tr>)}</tbody></table></div>{!entries.length && <p className="empty-state">No audit entries found.</p>}<div className="pagination">{page > 1 && <Link href={`/audit?page=${page - 1}`}>Previous</Link>}<span>Page {page}</span>{entries.length > 50 && <Link href={`/audit?page=${page + 1}`}>Next</Link>}</div></>;
}