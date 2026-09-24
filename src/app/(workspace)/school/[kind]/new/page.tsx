import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/auth/http";
import { can } from "@/lib/auth/policy";
import { db } from "@/lib/db";
import { schoolModules } from "@/lib/school/modules";
import { RecordForm, type RecordField } from "@/components/record-form";

export default async function NewRecordPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params; const schoolModule = schoolModules[kind]; if (!schoolModule) notFound();
  const user = await currentUser(); if (!user || !can(user, schoolModule.create)) redirect("/account");
  const field = (name: string, label: string, type = "text", value?: string, required = true): RecordField => ({ name, label, type, value, required });
  let fields: RecordField[];
  if (kind === "courses") fields = [field("name", "Course name"), field("description", "Description", "text", "", false), field("duration", "Duration (months)", "number", "6"), field("monthlyFee", "Monthly fee (INR)", "number", "0"), field("fullFee", "Full course fee (INR)", "number", "0")];
  else if (kind === "parents") fields = [field("name", "Parent name"), field("mobile", "Mobile", "tel"), field("whatsapp", "WhatsApp", "tel", "", false), field("email", "Email", "email", "", false), field("address", "Address"), field("city", "City", "text", "", false), field("state", "State", "text", "", false), field("pincode", "Pincode", "text", "", false)];
  else {
    const courses = await db.course.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
    const courseField: RecordField = { name: "courseId", label: "Course", required: true, options: courses.map(course => ({ value: course.id, label: course.name })) };
    if (kind === "batches") fields = [field("name", "Batch name"), courseField, field("schedule", "Schedule")];
    else {
      const [parents, batches] = await Promise.all([
        db.parent.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, mobile: true } }),
        db.batch.findMany({ where: { active: true }, include: { course: { select: { name: true } } }, orderBy: { name: "asc" } }),
      ]);
      fields = [field("name", "Student name"), field("dateOfBirth", "Date of birth", "date", "", false), field("grade", "Grade", "text", "", false), field("school", "School", "text", "", false),
        { name: "parentId", label: "Primary parent", required: true, options: parents.map(parent => ({ value: parent.id, label: `${parent.name} (${parent.mobile})` })) }, courseField,
        { name: "batchId", label: "Batch", options: batches.map(batch => ({ value: batch.id, label: `${batch.name} - ${batch.course.name}` })) },
        field("enrollmentDate", "Enrollment date", "date", new Date().toISOString().slice(0, 10)),
        { name: "paymentPlan", label: "Payment plan", value: "MONTHLY", required: true, options: [{ value: "MONTHLY", label: "Monthly" }, { value: "ONE_TIME", label: "One-time / Full payment" }] },
        field("fee", "Plan fee (INR)", "number", "0"), field("scholarship", "Scholarship (INR)", "number", "0"), field("discount", "Discount (INR)", "number", "0"), field("billingDay", "Billing day (1-28)", "number", "1"), field("dueDay", "Due day (1-28)", "number", "10")];
    }
  }
  return <><Link href={`/school/${kind}`}>Back to {schoolModule.title.toLowerCase()}</Link><h1 className="mt-6">New {kind === "batches" ? "batch" : kind.slice(0, -1)}</h1><RecordForm kind={kind} fields={fields} /></>;
}