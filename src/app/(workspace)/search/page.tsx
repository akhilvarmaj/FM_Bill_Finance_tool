import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { currentUser } from "@/lib/auth/http";
import { can } from "@/lib/auth/policy";
import { invoiceScope } from "@/lib/billing/rules";
import { db } from "@/lib/db";
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await currentUser(); if (!user) redirect("/login");
  const query = ((await searchParams).q ?? "").trim().slice(0, 100);
  const contains = { contains: query, mode: "insensitive" as const };
  const [students, parents, courses, invoices] = query.length < 2 ? [[], [], [], []] : await Promise.all([
    user.role === "PARENT" || can(user, "students.view") ? db.student.findMany({ where: { ...(user.role === "PARENT" ? { parent: { userId: user.id } } : {}), OR: [{ name: contains }, { studentCode: contains }] }, select: { id: true, name: true, studentCode: true }, take: 20 }) : [],
    can(user, "parents.view") ? db.parent.findMany({ where: { OR: [{ name: contains }, { mobile: contains }, { email: contains }] }, select: { id: true, name: true }, take: 20 }) : [],
    can(user, "courses.view") ? db.course.findMany({ where: { name: contains }, select: { id: true, name: true }, take: 20 }) : [],
    user.role === "PARENT" || can(user, "invoices.view") ? db.invoice.findMany({ where: { AND: [invoiceScope(user), { OR: [{ number: contains }, { studentName: contains }, { studentCode: contains }] }] }, select: { id: true, number: true, studentName: true }, take: 20 }) : [],
  ]);
  const groups = [
    { title: "Students", all: `/school/students?q=${encodeURIComponent(query)}`, items: students.map(record => ({ id: record.id, title: `${record.name} (${record.studentCode})`, href: user.role === "PARENT" ? `/portal?child=${record.id}` : `/school/students?q=${encodeURIComponent(record.studentCode)}` })) },
    { title: "Parents", all: `/school/parents?q=${encodeURIComponent(query)}`, items: parents.map(record => ({ id: record.id, title: record.name, href: `/school/parents?q=${encodeURIComponent(record.name)}` })) },
    { title: "Courses", all: `/school/courses?q=${encodeURIComponent(query)}`, items: courses.map(record => ({ id: record.id, title: record.name, href: `/school/courses?q=${encodeURIComponent(record.name)}` })) },
    { title: "Invoices", all: `/invoices?q=${encodeURIComponent(query)}`, items: invoices.map(record => ({ id: record.id, title: `${record.number} / ${record.studentName}`, href: `/invoices/${record.id}` })) },
  ];
  return <><h1>Search</h1><form className="filter-bar"><label className="field">Search records<input name="q" defaultValue={query} minLength={2} maxLength={100} required /></label><button className="primary-button"><Search size={17} />Search</button></form>{query.length >= 2 && !groups.some(group => group.items.length) && <p className="empty-state">No matching records.</p>}{groups.filter(group => group.items.length).map(group => <section className="data-section" key={group.title}><h2>{group.title}</h2>{group.items.map(item => <p key={item.id}><Link href={item.href}>{item.title}</Link></p>)}{group.items.length === 20 && <Link href={group.all}>View all matches</Link>}</section>)}</>;
}