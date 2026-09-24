import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/http";
import { can } from "@/lib/auth/policy";
import { db } from "@/lib/db";
import { RecordForm } from "@/components/record-form";
export default async function EnrollmentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || !can(user, "enrollments.manage")) redirect("/account");
  const record = await db.enrollment.findUnique({ where: { id: (await params).id }, include: { student: true, course: true } });
  if (!record) notFound();
  const batches = await db.batch.findMany({ where: { courseId: record.courseId, OR: [{ active: true }, { id: record.batchId ?? "" }] }, orderBy: { name: "asc" } });
  return <><h1>Edit Enrollment</h1><h2>{record.student.name} / {record.course.name}</h2><RecordForm kind="enrollments" id={record.id} endpoint={`/api/enrollments/${record.id}`} method="PATCH" destination="/enrollments" fields={[
    { name: "updatedAt", label: "", type: "hidden", value: record.updatedAt.toISOString() },
    { name: "batchId", label: "Batch", value: record.batchId ?? "", options: batches.map(batch => ({ value: batch.id, label: batch.name })) },
    { name: "enrollmentDate", label: "Start date", type: "date", required: true, value: record.enrollmentDate.toISOString().slice(0, 10) },
    { name: "paymentPlan", label: "Payment plan", required: true, value: record.paymentPlan, options: [{ value: "MONTHLY", label: "Monthly" }, { value: "ONE_TIME", label: "One-time" }] },
    ...(["fee", "scholarship", "discount", "billingDay", "dueDay"] as const).map(name => ({ name, label: ({ fee: "Fee (INR)", scholarship: "Scholarship (INR)", discount: "Discount (INR)", billingDay: "Billing day (1-28)", dueDay: "Due day (1-28)" })[name], type: "number", value: record[name].toString(), required: true })),
    { name: "active", label: "Status", required: true, value: String(record.active), options: [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }] },
  ]} /></>;
}