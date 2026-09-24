"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { paymentModes } from "@/lib/billing/rules";

export type BillingEnrollment = { id: string; student: string; parent: string; address: string; course: string; plan: string; fee: string; scholarship: string; discount: string; dueDay?: number };
export function BillForm({ enrollments, canPay, initialEnrollment = "", initialPeriod }: { enrollments: BillingEnrollment[]; canPay: boolean; initialEnrollment?: string; initialPeriod?: string }) {
  const router = useRouter();
  const initial = enrollments.find(value => value.id === initialEnrollment);
  const [selected, setSelected] = useState(initial?.id ?? ""); const enrollment = enrollments.find(value => value.id === selected);
  const [gross, setGross] = useState(initial?.fee ?? "0"); const [scholarship, setScholarship] = useState(initial?.scholarship ?? "0"); const [discount, setDiscount] = useState(initial?.discount ?? "0");
  const [review, setReview] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [requestKey] = useState(() => crypto.randomUUID());
  const today = new Date().toISOString().slice(0, 10);
  const total = Math.round((Number(gross) - Number(scholarship) - Number(discount)) * 100) / 100;
  function select(id: string) { setSelected(id); const value = enrollments.find(item => item.id === id); setGross(value?.fee ?? "0"); setScholarship(value?.scholarship ?? "0"); setDiscount(value?.discount ?? "0"); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    if (!review) { setReview(Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>); setError(""); return; }
    setBusy(true); setError("");
    try {
      const data = { ...Object.fromEntries(new FormData(event.currentTarget)), requestKey };
      const response = await fetch("/api/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const result = await response.json(); if (!response.ok) { setError(result.error ?? "Unable to create invoice."); return; }
      router.push(`/invoices/${result.id}`); router.refresh();
    } catch { setError("Unable to connect. Please try again."); } finally { setBusy(false); }
  }
  return <form className="form-stack edit-form bill-editor" onSubmit={submit}>
    <ol className="billing-steps"><li className={!review ? "current" : "complete"}><span>{review ? <Check size={13} /> : "1"}</span>Student & fees</li><li className={review ? "current" : ""}><span>2</span>Review & generate</li></ol>
    <div hidden={!!review} className="bill-fields">
    <label className="field">Student and course<select name="enrollmentId" required value={selected} onChange={event => select(event.target.value)}><option value="">Select enrollment</option>{enrollments.map(value => <option key={value.id} value={value.id}>{value.student} - {value.course}</option>)}</select></label>
    {enrollment && <dl className="profile-details"><div><dt>Parent</dt><dd>{enrollment.parent}</dd></div><div><dt>Address</dt><dd>{enrollment.address}</dd></div><div><dt>Payment plan</dt><dd>{enrollment.plan === "MONTHLY" ? "Monthly" : "One-time / Full payment"}</dd></div></dl>}
    <div className="record-grid" hidden={!enrollment}>
      <label className="field" hidden={enrollment?.plan === "ONE_TIME"}>Billing month<input type="month" name="period" defaultValue={initialPeriod && /^\d{4}-(0[1-9]|1[0-2])$/.test(initialPeriod) ? initialPeriod : today.slice(0, 7)} required /></label>
      <label className="field">Invoice date<input type="date" name="invoiceDate" defaultValue={today} required /></label>
      <label className="field">Due date<input key={selected} type="date" name="dueDate" defaultValue={[today, `${initialPeriod && /^\d{4}-(0[1-9]|1[0-2])$/.test(initialPeriod) ? initialPeriod : today.slice(0, 7)}-${String(enrollment?.dueDay ?? 10).padStart(2, "0")}`].sort().at(-1)} required /></label>
      <label className="field">Gross amount (INR)<input type="number" name="gross" min="0" step="0.01" value={gross} onChange={event => setGross(event.target.value)} required /></label>
      <label className="field">Payment received (INR)<input type="number" name="paid" min="0" step="0.01" max={Math.max(0, total)} defaultValue="0" readOnly={!canPay} required /></label>
      <label className="field">Payment mode<select name="mode">{paymentModes.map(mode => <option key={mode} value={mode}>{mode.replaceAll("_", " ")}</option>)}</select></label>
      <label className="field">Transaction reference (optional)<input name="reference" maxLength={150} /></label>
    </div><details className="inline-setup" hidden={!enrollment} open={Number(scholarship) > 0 || Number(discount) > 0 ? true : undefined}><summary>Scholarship & discount</summary><div className="record-grid"><label className="field">Scholarship (INR)<input type="number" name="scholarship" min="0" step="0.01" value={scholarship} onChange={event => setScholarship(event.target.value)} required /></label><label className="field">Discount (INR)<input type="number" name="discount" min="0" step="0.01" value={discount} onChange={event => setDiscount(event.target.value)} required /></label></div></details></div>{review && <section className="bill-review"><p className="eyebrow">Invoice preview</p><h2>{enrollment?.student}</h2><p>{enrollment?.course} / {enrollment?.plan === "MONTHLY" ? review.period : "Full course"}</p><dl><div><dt>Billed to</dt><dd>{enrollment?.parent}</dd></div><div><dt>Invoice date</dt><dd>{review.invoiceDate}</dd></div><div><dt>Due date</dt><dd>{review.dueDate}</dd></div><div><dt>Fee</dt><dd>INR {gross}</dd></div><div><dt>Scholarship + discount</dt><dd>INR {(Number(scholarship) + Number(discount)).toFixed(2)}</dd></div><div><dt>Payment received</dt><dd>INR {review.paid}</dd></div><div><dt>Remaining balance</dt><dd>INR {(total - Number(review.paid)).toFixed(2)}</dd></div></dl></section>}
    <p className="bill-total">Invoice total <strong>INR {Number.isFinite(total) ? total.toFixed(2) : "0.00"}</strong></p>
    {error && <p className="notice error" role="alert">{error}</p>}<div className="billing-form-actions">{review && <button type="button" className="secondary-button" onClick={() => setReview(null)} disabled={busy}><ArrowLeft size={16} />Edit details</button>}<button className="primary-button" disabled={busy || !enrollment || total < 0}>{review ? <FilePlus2 size={17} /> : <ArrowRight size={17} />}{busy ? "Generating..." : review ? "Confirm & generate bill" : "Review bill"}</button></div>
  </form>;
}