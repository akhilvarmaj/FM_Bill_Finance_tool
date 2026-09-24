import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { currentUser } from "@/lib/auth/http";
import { can } from "@/lib/auth/policy";
import { schoolModules } from "@/lib/school/modules";
import { db } from "@/lib/db";

export default async function SchoolPage({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<{ q?: string; page?: string }> }) {
  const { kind } = await params; const schoolModule = schoolModules[kind]; if (!schoolModule) notFound();
  const user = await currentUser(); if (!user) redirect("/login");
  const parentView = user.role === "PARENT" && kind === "students";
  if (!parentView && !can(user, schoolModule.view)) redirect("/account");
  const search = await searchParams; const query = (search.q ?? "").slice(0, 100);
  const page = Math.max(1, Math.min(10000, Math.floor(Number(search.page) || 1)));
  const take = 26; const skip = (page - 1) * 25;
  const editPermission = ({ students: "students.edit", parents: "parents.edit", courses: "courses.manage", batches: "batches.manage" } as const)[kind as "students" | "parents" | "courses" | "batches"];
  const editable = can(user, editPermission);
  let headings: string[]; let rows: { id: string; cells: string[] }[];
  if (kind === "courses") {
    headings = ["Course", "Duration", "Monthly fee", "Full fee", "Status"];
    rows = (await db.course.findMany({ where: { name: { contains: query, mode: "insensitive" } }, orderBy: { name: "asc" }, take, skip })).map(record => ({ id: record.id, cells: [record.name, `${record.duration} months`, `INR ${record.monthlyFee}`, `INR ${record.fullFee}`, record.active ? "Active" : "Inactive"] }));
  } else if (kind === "parents") {
    headings = ["Parent", "Mobile", "Email", "Address", "Children"];
    rows = (await db.parent.findMany({ where: { OR: [{ name: { contains: query, mode: "insensitive" } }, { mobile: { contains: query } }] }, include: { _count: { select: { students: true } } }, orderBy: { name: "asc" }, take, skip })).map(record => ({ id: record.id, cells: [record.name, record.mobile, record.email ?? "", record.address, String(record._count.students)] }));
  } else if (kind === "batches") {
    headings = ["Batch", "Course", "Schedule", "Status"];
    rows = (await db.batch.findMany({ where: { name: { contains: query, mode: "insensitive" } }, include: { course: true }, orderBy: { name: "asc" }, take, skip })).map(record => ({ id: record.id, cells: [record.name, record.course.name, record.schedule, record.active ? "Active" : "Inactive"] }));
  } else {
    headings = ["Student ID", "Name", "Parent", "Courses", "Payment plan", "Enrolled"];
    rows = (await db.student.findMany({ where: { ...(parentView ? { parent: { userId: user.id } } : {}), OR: [{ name: { contains: query, mode: "insensitive" } }, { studentCode: { contains: query, mode: "insensitive" } }, { parent: { mobile: { contains: query } } }, { parent: { name: { contains: query, mode: "insensitive" } } }] }, include: { parent: { select: { name: true } }, enrollments: { include: { course: { select: { name: true } } } } }, orderBy: { createdAt: "desc" }, take, skip })).map(record => ({ id: record.id, cells: [record.studentCode, record.name, record.parent.name, record.enrollments.map(enrollment => enrollment.course.name).join(", "), record.enrollments.map(enrollment => enrollment.paymentPlan === "MONTHLY" ? "Monthly" : "One-time").join(", "), record.enrollments.map(enrollment => enrollment.enrollmentDate.toISOString().slice(0, 10)).join(", ")] }));
  }
  return <><div className="page-heading"><h1>{parentView ? "My Children" : schoolModule.title}</h1>{can(user, schoolModule.create) && <Link className="primary-button" href={`/school/${kind}/new`}><Plus size={17} />New {kind === "batches" ? "batch" : kind.slice(0, -1)}</Link>}</div>
    <form className="filter-bar"><label className="field">Search<input name="q" defaultValue={query} /></label><button className="secondary-button"><Search size={17} />Search</button></form>
    <div className="table-scroll"><table><thead><tr>{headings.map(heading => <th key={heading}>{heading}</th>)}{editable && <th>Action</th>}</tr></thead><tbody>{rows.slice(0, 25).map(row => <tr key={row.id}>{row.cells.map((cell, index) => <td key={index}>{cell}</td>)}{editable && <td><Link href={`/school/${kind}/${row.id}`}>Edit</Link></td>}</tr>)}</tbody></table></div>
    {!rows.length && <p className="empty-state">No {kind} found.</p>}<div className="pagination">{page > 1 && <Link href={`?q=${encodeURIComponent(query)}&page=${page - 1}`}>Previous</Link>}<span>Page {page}</span>{rows.length > 25 && <Link href={`?q=${encodeURIComponent(query)}&page=${page + 1}`}>Next</Link>}</div></>;
}