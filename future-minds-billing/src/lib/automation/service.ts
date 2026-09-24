import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { automationSchema, scheduledHourReached } from "./config";
import { generateMonthlyInvoices } from "@/lib/billing/monthly";
import { reportPeriod } from "@/lib/reports/period";
export async function automationSettings() {
  return automationSchema.parse((await db.systemSetting.findUnique({ where: { key: "automation" } }))?.value ?? {});
}
export async function runAutomation(force = false) {
  const settings = await automationSettings();
  if (!settings.active || (!force && !scheduledHourReached(settings.hour))) return { skipped: true, reason: "Disabled or before scheduled hour" };
  const account = await db.user.findUnique({ where: { id: settings.actorId } });
  if (!account || account.roleName !== "ADMIN" || account.status !== "APPROVED") return { skipped: true, reason: "An approved administrator must enable automation" };
  const today = reportPeriod({ period: "Today" }).to.toISOString().slice(0, 10); const token = randomUUID(); const now = new Date();
  const claimed = await db.$transaction(async transaction => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(64021003)`;
    const record = await transaction.systemSetting.findUnique({ where: { key: "automation-run" } });
    const state = record?.value as { leaseUntil?: string; completedDate?: string } | null;
    if (state?.leaseUntil && new Date(state.leaseUntil) > now) return false;
    if (!force && state?.completedDate === today) return false;
    const value = { token, leaseUntil: new Date(now.getTime() + 10 * 60000).toISOString(), startedAt: now.toISOString() };
    await transaction.systemSetting.upsert({ where: { key: "automation-run" }, create: { key: "automation-run", value }, update: { value } });
    return true;
  });
  if (!claimed) return { skipped: true, reason: "Already running or completed today" };
  try {
    const result = await generateMonthlyInvoices({ id: account.id, role: account.roleName, status: account.status, permissions: [] });
    await finish({ ...result, completedDate: result.remaining ? "" : today, finishedAt: new Date().toISOString() });
    return result;
  } catch {
    await finish({ error: "Billing job failed; review enrollments and database availability.", finishedAt: new Date().toISOString() });
    throw new Error("Billing job failed.");
  }
  async function finish(value: Record<string, string | number | boolean>) {
    await db.$transaction(async transaction => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(64021003)`;
      const state = (await transaction.systemSetting.findUnique({ where: { key: "automation-run" } }))?.value as { token?: string } | null;
      if (state?.token !== token) return;
      await transaction.systemSetting.update({ where: { key: "automation-run" }, data: { value } });
      await transaction.auditLog.create({ data: { actorId: account!.id, action: "AUTOMATION_RUN", entityId: today, details: value } });
    });
  }
}