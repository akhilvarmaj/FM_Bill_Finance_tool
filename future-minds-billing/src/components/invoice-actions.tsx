"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Ban, CreditCard, Printer } from "lucide-react";
import { paymentModes } from "@/lib/billing/rules";
export function InvoiceActions({ id, outstanding, pay, cancel }: { id: string; outstanding: string; pay: boolean; cancel: boolean }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  async function submit(event: FormEvent<HTMLFormElement>, action: string) {
    event.preventDefault(); if (busy || !window.confirm(action === "cancel" ? "Cancel this invoice permanently? It will remain in history." : "Record this payment? Payment records cannot be edited.")) return;
    setBusy(true); setError(""); const form = event.currentTarget;
    const body = { ...Object.fromEntries(new FormData(form)), ...(action === "payment" ? { requestKey } : {}) };
    try { const response = await fetch(`/api/invoices/${id}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json(); if (!response.ok) { setError(result.error ?? "Unable to save."); return; } setRequestKey(crypto.randomUUID()); form.reset(); router.refresh(); }
    catch { setError("Unable to connect. Retry without changing payment details."); } finally { setBusy(false); }
  }
  return <div className="no-print"><button className="secondary-button" onClick={() => window.print()}><Printer size={17} />Print</button>
    {pay && <section className="data-section"><h2>Record payment</h2><form className="filter-bar" onSubmit={event => submit(event, "payment")}><label className="field">Amount (INR)<input name="amount" type="number" min="0.01" step="0.01" max={outstanding} required /></label><label className="field">Mode<select name="mode">{paymentModes.map(mode => <option key={mode}>{mode}</option>)}</select></label><label className="field">Date<input name="paidAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label><label className="field">Reference<input name="reference" maxLength={150} /></label><button className="primary-button" disabled={busy}><CreditCard size={17} />Record payment</button></form></section>}
    {cancel && <section className="data-section"><h2>Cancel invoice</h2><form className="filter-bar" onSubmit={event => submit(event, "cancel")}><label className="field">Cancellation reason<input name="reason" minLength={3} maxLength={500} required /></label><button className="secondary-button" disabled={busy}><Ban size={17} />Cancel invoice</button></form></section>}
    {error && <p className="notice error" role="alert">{error}</p>}</div>;
}