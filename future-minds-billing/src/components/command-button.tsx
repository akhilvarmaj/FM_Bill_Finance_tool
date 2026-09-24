"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, RefreshCw } from "lucide-react";
export function CommandButton({ endpoint, body, label, confirm }: { endpoint: string; body?: Record<string, string>; label: string; confirm?: string }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function run() {
    if (busy || (confirm && !window.confirm(confirm))) return; setBusy(true); setMessage("");
    try { const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) }); const result = await response.json(); setMessage(response.ok ? (result.skipped ? result.reason : result.generated !== undefined ? `${result.generated} invoices generated.${result.remaining ? " More remain; run again." : ""}` : "Saved.") : result.error ?? "Unable to complete."); if (response.ok) router.refresh(); }
    catch { setMessage("Unable to connect. Please try again."); } finally { setBusy(false); }
  }
  return <div><button className="secondary-button" onClick={run} disabled={busy}>{busy ? <RefreshCw size={17} /> : <Check size={17} />}{label}</button>{message && <p role="status" className="muted">{message}</p>}</div>;
}