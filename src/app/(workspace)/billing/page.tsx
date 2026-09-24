import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/http";
import { can } from "@/lib/auth/policy";
import { db } from "@/lib/db";
import { BillingWorkspace } from "@/components/billing-workspace";
export default async function BillingPage({ searchParams }: { searchParams: Promise<{ enrollment?: string; period?: string }> }) {
  const user = await currentUser(); if (!user || !can(user, "invoices.create")) redirect("/account");
  const enrollments = await db.enrollment.findMany({ where: { active: true, student: { active: true } }, include: { student: { include: { parent: true } }, course: true }, orderBy: { student: { name: "asc" } } });
  const canIntake = can(user, "students.create") && can(user, "enrollments.manage");
  const [parents, courses, params] = await Promise.all([canIntake ? db.parent.findMany({ select: { id: true, name: true, mobile: true }, orderBy: { name: "asc" } }) : [], canIntake ? db.course.findMany({ where: { active: true }, orderBy: { name: "asc" } }) : [], searchParams]);
  return <><div className="page-heading"><div><p className="eyebrow">Future Minds / Billing</p><h1>Create a bill</h1></div></div><BillingWorkspace key={params.enrollment ?? "billing"} canPay={can(user, "payments.create")} canIntake={canIntake} canParent={can(user, "parents.create")} canCourse={can(user, "courses.manage")} initialEnrollment={params.enrollment} initialPeriod={params.period} parents={parents} courses={courses.map(course => ({ id: course.id, name: course.name, monthlyFee: course.monthlyFee.toString(), fullFee: course.fullFee.toString() }))} enrollments={enrollments.map(value => ({ id: value.id, student: `${value.student.name} (${value.student.studentCode})`, parent: value.student.parent.name, address: value.student.parent.address, course: value.course.name, plan: value.paymentPlan, fee: value.fee.toString(), scholarship: value.scholarship.toString(), discount: value.discount.toString(), dueDay: value.dueDay }))} /></>;
}