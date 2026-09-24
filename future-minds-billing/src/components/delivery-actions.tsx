"use client";
import { useState } from "react";
import Link from "next/link";
import { Mail, MessageCircle } from "lucide-react";
export function DeliveryActions({ invoiceId }: { invoiceId: string }) {
  const [keys] = useState(() => ({ EMAIL: crypto.randomUUID(), WHATSAPP: crypto.randomUUID() })); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function send(channel: "EMAIL" | "WHATSAPP") {
    if (busy || (channel === "EMAIL" && !window.confirm("Email this invoice PDF to the saved parent email address?"))) return;
    const popup = channel === "WHATSAPP" ? window.open("about:blank", "_blank") : null;
    if (popup) popup.opener = null;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/delivery`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel, requestKey: keys[channel] }) });
      const data = await response.json();
      if (!response.ok) { popup?.close(); setMessage(data.error ?? "Unable to request delivery."); return; }
      if (data.href && popup) popup.location.href = data.href;
      setMessage(channel === "EMAIL" ? `Email status: ${data.status}` : popup ? "WhatsApp opened. Delivery is not confirmed." : "Browser blocked the WhatsApp window. Allow popups and retry.");
    } catch { popup?.close(); setMessage("Connection interrupted. Retry to check the same request."); } finally { setBusy(false); }
  }
  return <div className="no-print"><div className="filter-bar"><button className="secondary-button" disabled={busy} onClick={() => void send("EMAIL")}><Mail size={17} />Email PDF</button><button className="secondary-button" disabled={busy} onClick={() => void send("WHATSAPP")}><MessageCircle size={17} />Open WhatsApp</button><Link href="/deliveries">Delivery history</Link></div>{message && <p role="status">{message}</p>}</div>;
}