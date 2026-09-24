"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setPending(true); setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error();
      router.replace("/login"); router.refresh();
    } catch { setError("Unable to sign out. Please try again."); }
    finally { setPending(false); }
  }
  return <div><button className="secondary-button" disabled={pending} onClick={logout}><LogOut size={17} />{pending ? "Signing out..." : "Sign out"}</button>{error && <p role="alert" className="notice error">{error}</p>}</div>;
}