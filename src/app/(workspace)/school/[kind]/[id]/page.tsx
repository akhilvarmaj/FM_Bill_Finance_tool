import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/http";
import { can } from "@/lib/auth/policy";
import { db } from "@/lib/db";
import { RecordForm, type RecordField } from "@/components/record-form";

export default async function EditRecordPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  const permission = ({ courses: "courses.manage", parents: "parents.edit", batches: "batches.manage", students: "students.edit" } as const)[kind as "courses" | "parents" | "batches" | "students"];
  if (!permission) notFound(); const user = await currentUser(); if (!user || !can(user, permission)) redirect("/account");
  const field = (name: string, label: string, value: unknown, type = "text", required = true): RecordField => ({ name, label, value: String(value ?? ""), type, required });
  const active = (value: boolean): RecordField => ({ name: "active", label: "Status", value: String(value), required: true, options: [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }] });
  let fields: RecordField[]; let title: string;
  if (kind === "courses") {
    const record = await db.course.findUnique({ where: { id } }); if (!record) notFound(); title = record.name;
    fields = [field("name", "Course name", record.name), field("description", "Description", record.description, "text", false), field("duration", "Duration (months)", record.duration, "number"), field("monthlyFee", "Monthly fee (INR)", record.monthlyFee, "number"), field("fullFee", "Full fee (INR)", record.fullFee, "number"), active(record.active)];
  } else if (kind === "parents") {
    const record = await db.parent.findUnique({ where: { id } }); if (!record) notFound(); title = record.name;
    fields = [field("name", "Parent name", record.name), field("mobile", "Mobile", record.mobile, "tel"), field("address", "Address", record.address), field("email", "Contact email", record.email, "email", false), field("whatsapp", "WhatsApp", record.whatsapp, "tel", false), field("city", "City", record.city, "text", false), field("state", "State", record.state, "text", false), field("pincode", "Pincode", record.pincode, "text", false)];
  } else if (kind === "batches") {
    const record = await db.batch.findUnique({ where: { id } }); if (!record) notFound(); title = record.name;
    fields = [field("name", "Batch name", record.name), field("schedule", "Schedule", record.schedule), active(record.active)];
  } else {
    const record = await db.student.findUnique({ where: { id } }); if (!record) notFound(); title = record.name;
    fields = [field("name", "Student name", record.name), field("grade", "Grade", record.grade, "text", false), field("school", "School", record.school, "text", false), active(record.active)];
  }
  return <><p className="eyebrow">Edit record</p><h1>{title}</h1><RecordForm kind={kind} id={id} fields={fields} /></>;
}