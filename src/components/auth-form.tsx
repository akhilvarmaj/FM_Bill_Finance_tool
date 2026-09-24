"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const registering = mode === "register";
  const [role, setRole] = useState("PARENT");
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true); setError(""); setSuccess("");
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values),
      });
      const result: { error?: string; message?: string } = await response.json();
      if (!response.ok) { setError(result.error ?? "Unable to submit. Please try again."); return; }
      if (registering) { setSuccess(result.message ?? "Registration received."); form.reset(); setRole("PARENT"); }
      else { router.replace("/"); router.refresh(); }
    } catch { setError("Unable to connect. Please try again."); }
    finally { setPending(false); }
  }

  return <section className="auth-panel">
    <p className="eyebrow">Future Minds Billing</p>
    <h1>{registering ? "Create your account" : "Welcome back"}</h1>
    <nav className="auth-tabs" aria-label="Account access">
      <Link href="/login" aria-current={!registering ? "page" : undefined}>Sign in</Link>
      <Link href="/register" aria-current={registering ? "page" : undefined}>Register</Link>
    </nav>
    <form className="form-stack" onSubmit={submit} aria-busy={pending}>
      {registering && <>
        <fieldset className="role-choice"><legend>Account type</legend>
          <label><input type="radio" name="role" value="PARENT" checked={role === "PARENT"} onChange={() => setRole("PARENT")} />Parent</label>
          <label><input type="radio" name="role" value="STAFF" checked={role === "STAFF"} onChange={() => setRole("STAFF")} />Staff</label>
        </fieldset>
        <label className="field">Full name<input name="name" autoComplete="name" required minLength={2} maxLength={100} /></label>
      </>}
      <label className="field">Email address<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
      <label className="field" htmlFor="password">Password{registering && " (at least 12 characters)"}
        <span className="password-field">
          <input id="password" name="password" type={visible ? "text" : "password"} autoComplete={registering ? "new-password" : "current-password"} required minLength={registering ? 12 : 1} maxLength={128} />
          <button type="button" className="icon-button" aria-label={visible ? "Hide password" : "Show password"} title={visible ? "Hide password" : "Show password"} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
        </span>
      </label>
      {registering && <>
        <label className="field">Mobile number<input name="mobile" type="tel" autoComplete="tel" required minLength={8} maxLength={20} /></label>
        <label className="field">Address{role === "STAFF" && " (optional)"}<textarea name="address" autoComplete="street-address" required={role === "PARENT"} minLength={role === "PARENT" ? 5 : undefined} maxLength={500} rows={2} /></label>
      </>}
      {error && <div className="notice error" role="alert">{error}</div>}
      {success && <div className="notice" role="status">{success}</div>}
      <button className="primary-button" disabled={pending} type="submit">
        {pending ? <LoaderCircle size={17} className="animate-spin" aria-hidden /> : null}
        {pending ? "Please wait..." : registering ? "Request an account" : "Sign in"}
        {!pending && <ArrowRight size={17} aria-hidden />}
      </button>
    </form>
  </section>;
}