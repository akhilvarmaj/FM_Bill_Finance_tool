"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";

export type RecordField = { name: string; label: string; type?: string; required?: boolean; value?: string; options?: { value: string; label: string }[] };
export function RecordForm({ kind, fields, id, endpoint, destination, method }: { kind: string; fields: RecordField[]; id?: string; endpoint?: string; destination?: string; method?: "POST" | "PATCH" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    if (id && !window.confirm("Save changes to this record?")) return;
    setBusy(true); setError("");
    const data: Record<string, FormDataEntryValue | boolean> = Object.fromEntries(new FormData(event.currentTarget));
    if ("active" in data) data.active = data.active === "true";
    for (const field of fields) if (field.type === "checkbox") data[field.name] = new FormData(event.currentTarget).has(field.name);
    try {
      const response = await fetch(endpoint ?? `/api/school/${kind}${id ? `/${id}` : ""}`, { method: method ?? (id && !endpoint ? "PATCH" : "POST"), headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? "Unable to save."); return; }
      router.push(destination ?? `/school/${kind}`); router.refresh();
    } catch { setError("Unable to connect. Please try again."); }
    finally { setBusy(false); }
  }
  return <form className="form-stack edit-form" onSubmit={submit}><div className="record-grid">{fields.map(field => field.type === "hidden" ? <input key={field.name} type="hidden" name={field.name} value={field.value} /> : <label className="field" key={field.name}>{field.label}{field.required ? " *" : ""}
    {field.type === "checkbox" ? <input type="checkbox" name={field.name} defaultChecked={field.value === "true"} /> : field.options ? <select name={field.name} required={field.required} defaultValue={field.value ?? ""}><option value="">Select</option>{field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
      : <input name={field.name} type={field.type ?? "text"} required={field.required} defaultValue={field.value} step={field.type === "number" ? "0.01" : undefined} min={field.type === "number" ? "0" : undefined} maxLength={500} />}
    </label>)}</div>{error && <p className="notice error" role="alert">{error}</p>}<button className="primary-button" disabled={busy}><Save size={17} />{busy ? "Saving..." : "Save record"}</button></form>;
}