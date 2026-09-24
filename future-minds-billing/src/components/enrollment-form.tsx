"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
export function EnrollmentForm({ students, courses, batches }: { students: { id: string; name: string; studentCode: string }[]; courses: { id: string; name: string; monthlyFee: string; fullFee: string }[]; batches: { id: string; name: string; courseId: string }[] }) {
  const router = useRouter(); const [courseId, setCourseId] = useState(""); const [plan, setPlan] = useState("MONTHLY"); const [fee, setFee] = useState("0"); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  function chooseCourse(id: string, paymentPlan: string) {
    setCourseId(id); setPlan(paymentPlan);
    const course = courses.find(record => record.id === id); setFee(course ? paymentPlan === "MONTHLY" ? course.monthlyFee : course.fullFee : "0");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; setBusy(true); setError("");
    const form = event.currentTarget;
    try {
      const response = await fetch("/api/enrollments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? "Unable to enroll student."); return; }
      router.push(`/enrollments/${result.id}`); router.refresh();
    } catch { setError("Unable to connect. Please retry."); } finally { setBusy(false); }
  }
  return <form className="form-stack edit-form" onSubmit={submit}><div className="record-grid">
    <label className="field">Student<select name="studentId" required><option value="">Select</option>{students.map(student => <option key={student.id} value={student.id}>{student.name} ({student.studentCode})</option>)}</select></label>
    <label className="field">Course<select name="courseId" value={courseId} onChange={event => chooseCourse(event.target.value, plan)} required><option value="">Select</option>{courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label>
    <label className="field">Batch<select key={courseId} name="batchId"><option value="">No batch</option>{batches.filter(batch => batch.courseId === courseId).map(batch => <option key={batch.id} value={batch.id}>{batch.name}</option>)}</select></label>
    <label className="field">Payment plan<select name="paymentPlan" value={plan} onChange={event => chooseCourse(courseId, event.target.value)}><option value="MONTHLY">Monthly</option><option value="ONE_TIME">One-time</option></select></label>
    <label className="field">Plan fee (INR)<input name="fee" type="number" min="0" step="0.01" value={fee} onChange={event => setFee(event.target.value)} required /></label>
    <label className="field">Start date<input name="enrollmentDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label>
    {([{ name: "scholarship", label: "Scholarship (INR)", value: "0", max: undefined }, { name: "discount", label: "Discount (INR)", value: "0", max: undefined }, { name: "billingDay", label: "Billing day", value: "1", max: 28 }, { name: "dueDay", label: "Due day", value: "10", max: 28 }]).map(field => <label className="field" key={field.name}>{field.label}<input name={field.name} type="number" min={field.max ? 1 : 0} max={field.max} step={field.max ? 1 : "0.01"} defaultValue={field.value} required /></label>)}
  </div>{error && <p className="notice error" role="alert">{error}</p>}<button className="primary-button" disabled={busy}><Save size={17} />{busy ? "Saving..." : "Add enrollment"}</button></form>;
}