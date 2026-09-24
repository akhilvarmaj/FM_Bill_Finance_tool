"use client";
import { RefreshCw } from "lucide-react";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="account-main"><h1>Temporarily unavailable</h1><p className="muted">We could not load your account. Please try again or contact your administrator.</p><button className="primary-button" onClick={reset}><RefreshCw size={17} />Try again</button></main>;
}