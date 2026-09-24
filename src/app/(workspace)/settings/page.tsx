import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/http";
import { instituteSettings } from "@/lib/management/service";
import { RecordForm } from "@/components/record-form";
import { automationSettings } from "@/lib/automation/service";
import { db } from "@/lib/db";
import { CommandButton } from "@/components/command-button";
export default async function SettingsPage() {
  if ((await currentUser())?.role !== "ADMIN") redirect("/account");
  const settings = await instituteSettings();
  const automation = await automationSettings();
  const run = (await db.systemSetting.findUnique({ where: { key: "automation-run" } }))?.value as { error?: string; finishedAt?: string; generated?: number; remaining?: boolean } | null;
  const labels = { name: "Institute name", address: "Address", phone: "Phone", email: "Email", website: "Website", gstin: "GSTIN (optional)", invoicePrefix: "Invoice prefix", paymentTerms: "Default payment terms (days)" };
  return <><h1>Institute Settings</h1><RecordForm kind="settings" endpoint="/api/management/settings" destination="/settings" fields={Object.entries(settings).map(([name, value]) => ({ name, label: labels[name as keyof typeof labels], value: String(value), type: name === "paymentTerms" ? "number" : name === "email" ? "email" : "text", required: ["name", "invoicePrefix", "paymentTerms"].includes(name) }))} /><section className="data-section"><h2>Automation</h2><RecordForm kind="automation" endpoint="/api/management/automation" destination="/settings" fields={[
    { name: "active", label: "Automatic monthly invoicing", type: "checkbox", value: String(automation.active) },
    { name: "emailReminders", label: "Automatic email reminders", type: "checkbox", value: String(automation.emailReminders) },
    { name: "hour", label: "Daily start hour (India, 0-23)", type: "number", value: String(automation.hour), required: true },
    { name: "reminderDays", label: "Reminder days before due date", value: automation.reminderDays, required: true },
  ]} /><div className="filter-bar"><CommandButton endpoint="/api/automation/run" label="Run billing job" confirm="Generate elapsed monthly invoices using the saved automation settings?" /></div>{run?.finishedAt && <p>Last run: {new Date(run.finishedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} / {run.generated ?? 0} invoices {run.remaining ? "/ More pending" : ""}</p>}{run?.error && <p className="notice error">{run.error}</p>}</section></>;
}