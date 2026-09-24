import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/http";
import { can } from "@/lib/auth/policy";
import { db } from "@/lib/db";
import Link from "next/link";
import { EnrollmentForm } from "@/components/enrollment-form";
import { formatMoney } from "@/lib/billing/rules";
export default async function EnrollmentsPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  const user = await currentUser(); if (!user || !can(user, "enrollments.manage")) redirect("/account");
  const params = await searchParams; const query = (params.q ?? "").trim().slice(0, 100); const page = Math.max(1, Math.min(10000, Math.floor(Number(params.page) || 1)));
  const [students, courses, batches, records] = await Promise.all([
    db.student.findMany({ where: { active: true }, select: { id: true, name: true, studentCode: true }, orderBy: { name: "asc" } }),
    db.course.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.batch.findMany({ where: { active: true }, select: { id: true, name: true, courseId: true } }),
    db.enrollment.findMany({ where: { OR: [{ student: { name: { contains: query, mode: "insensitive" } } }, { student: { studentCode: { contains: query, mode: "insensitive" } } }, { course: { name: { contains: query, mode: "insensitive" } } }] }, include: { student: true, course: true }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 26, skip: (page - 1) * 25 }),
  ]);
  return <><h1>Enrollments</h1><form className="filter-bar"><label className="field">Search<input name="q" defaultValue={query} /></label><button className="secondary-button">Search</button></form><div className="table-scroll"><table><thead><tr><th>Student</th><th>Course</th><th>Plan</th><th>Net fee</th><th>Status</th><th>Action</th></tr></thead><tbody>{records.slice(0, 25).map(record => <tr key={record.id}><td>{record.student.name}</td><td>{record.course.name}</td><td>{record.paymentPlan}</td><td>{formatMoney(record.fee.minus(record.scholarship).minus(record.discount))}</td><td>{record.active ? "Active" : "Inactive"}</td><td><Link href={`/enrollments/${record.id}`}>Edit</Link></td></tr>)}</tbody></table></div><div className="pagination">{page > 1 && <Link href={`?q=${encodeURIComponent(query)}&page=${page - 1}`}>Previous</Link>}<span>Page {page}</span>{records.length > 25 && <Link href={`?q=${encodeURIComponent(query)}&page=${page + 1}`}>Next</Link>}</div><section className="data-section"><h2>Add Enrollment</h2><EnrollmentForm students={students} courses={courses.map(course => ({ id: course.id, name: course.name, monthlyFee: course.monthlyFee.toString(), fullFee: course.fullFee.toString() }))} batches={batches} /></section></>;
}