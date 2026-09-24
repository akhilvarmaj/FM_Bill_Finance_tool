"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Save, KeyRound, UserPlus } from "lucide-react";
import { permissions } from "@/lib/auth/policy";

type Account = { id: string; name: string; email: string; roleName: string; status: string; updatedAt: string; permissions: string[] };

export function UserEditor({ account }: { account?: Account }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>, reset = false) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    if (account && !window.confirm(reset ? "Reset this password and sign out all sessions?" : "Save account access changes and sign out existing sessions?")) return;
    setBusy(true); setError(""); setMessage("");
    const body = reset ? { password: data.get("password") } : account ? { name: data.get("name"), status: data.get("status"), permissions: data.getAll("permissions"), updatedAt: account.updatedAt } : Object.fromEntries(data);
    try {
      const response = await fetch(account ? `/api/users/${account.id}` : "/api/users", { method: account && !reset ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? "Unable to save changes."); return; }
      setMessage(reset ? "Password reset. Existing sessions signed out." : "Account saved.");
      if (!account) { router.push(`/users/${result.id}`); }
      if (reset) form.reset();
      router.refresh();
    } catch { setError("Unable to connect. Please try again."); }
    finally { setBusy(false); }
  }
  return <><form className="form-stack edit-form" onSubmit={event => submit(event)}>
    <label className="field">Full name<input name="name" defaultValue={account?.name} required minLength={2} maxLength={100} /></label>
    {!account && <><label className="field">Email<input name="email" type="email" required autoComplete="off" /></label><label className="field">Initial password<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label></>}
    {account && <><label className="field">Account status<select name="status" defaultValue={account.status}>{(account.roleName === "ADMIN" ? ["APPROVED"] : ["PENDING", "APPROVED", "REJECTED", "INACTIVE"]).map(status => <option key={status}>{status}</option>)}</select></label>
      {account.roleName === "STAFF" && <fieldset className="permissions"><legend>Staff permissions</legend><div className="permission-grid">{permissions.map(permission => <label key={permission}><input type="checkbox" name="permissions" value={permission} defaultChecked={account.permissions.includes(permission)} />{permission.replaceAll(".", " · ")}</label>)}</div></fieldset>}
    </>}
    <button className="primary-button" disabled={busy}>{account ? <Save size={17} /> : <UserPlus size={17} />}{busy ? "Saving..." : account ? "Save account" : "Create staff account"}</button>
  </form>
  {account && <section className="data-section"><h2>Reset access</h2><form className="form-stack edit-form" onSubmit={event => submit(event, true)}><label className="field">New password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label><button className="secondary-button" disabled={busy}><KeyRound size={17} />Reset password</button></form></section>}
  {error && <p className="notice error" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}</>;
}