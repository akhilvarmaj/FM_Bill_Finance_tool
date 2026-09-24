import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, UserPlus } from "lucide-react";
import { Prisma, AccountStatus } from "@prisma/client";
import { currentUser } from "@/lib/auth/http";
import { db } from "@/lib/db";

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await currentUser();
  if (user?.role !== "ADMIN") redirect("/account");
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const status = typeof params.status === "string" && Object.values(AccountStatus).includes(params.status as AccountStatus) ? params.status as AccountStatus : undefined;
  const page = Math.max(1, Math.min(10000, Number(params.page) || 1));
  const where: Prisma.UserWhereInput = { ...(status ? { status } : {}), ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }, { mobile: { contains: query } }] } : {}) };
  const [accounts, count] = await db.$transaction([db.user.findMany({ where, skip: (Math.floor(page) - 1) * 25, take: 25, orderBy: { createdAt: "desc" }, select: { id: true, name: true, email: true, roleName: true, status: true } }), db.user.count({ where })]);
  const pageLink = (next: number) => `/users?${new URLSearchParams({ q: query, status: status ?? "", page: String(next) })}`;
  return <><div className="page-heading"><div><p className="eyebrow">Administration</p><h1>Users &amp; Access</h1></div><Link className="primary-button" href="/users/new"><UserPlus size={17} />Create staff</Link></div>
    <form className="filter-bar"><label className="field">Search<input name="q" defaultValue={query} placeholder="Name, email or mobile" /></label><label className="field">Status<select name="status" defaultValue={status ?? ""}><option value="">All accounts</option>{Object.values(AccountStatus).map(value => <option key={value}>{value}</option>)}</select></label><button className="secondary-button"><Search size={17} />Search</button></form>
    <p className="muted">{count} accounts</p><div className="table-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>{accounts.map(account => <tr key={account.id}><td>{account.name}</td><td>{account.email}</td><td>{account.roleName}</td><td><span className={`badge ${account.status.toLowerCase()}`}>{account.status}</span></td><td><Link href={`/users/${account.id}`}>Manage</Link></td></tr>)}</tbody></table></div>
    {!accounts.length && <p className="empty-state">No accounts found.</p>}<div className="pagination">{page > 1 && <Link href={pageLink(page - 1)}>Previous</Link>}<span>Page {Math.floor(page)}</span>{page * 25 < count && <Link href={pageLink(page + 1)}>Next</Link>}</div></>;
}