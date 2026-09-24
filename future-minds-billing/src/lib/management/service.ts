import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import type { Principal } from "@/lib/auth/policy";
import { requireAdmin, requirePermission, AuthError } from "@/lib/auth/service";
import { money } from "@/lib/school/validation";
import { paymentModes } from "@/lib/billing/rules";
import { instituteSchema, marketingCategories } from "./config";
import { automationSchema } from "@/lib/automation/config";
export async function instituteSettings() {
  const record = await db.systemSetting.findUnique({ where: { key: "institute" } });
  return instituteSchema.parse(record?.value ?? {});
}
export async function managementCommand(actor: Principal | null, action: string, input: unknown) {
  if (action === "automation") {
    const user = requireAdmin(actor); const data = { ...automationSchema.omit({ actorId: true }).parse(input), actorId: user.id };
    return db.$transaction(async transaction => {
      await transaction.systemSetting.upsert({ where: { key: "automation" }, create: { key: "automation", value: data }, update: { value: data } });
      await transaction.auditLog.create({ data: { actorId: user.id, action: "AUTOMATION_SETTINGS_UPDATED", entityId: "automation", details: data } });
      return { ok: true };
    });
  }
  if (action === "settings") {
    const user = requireAdmin(actor); const data = instituteSchema.parse(input);
    return db.$transaction(async transaction => {
      await transaction.systemSetting.upsert({ where: { key: "institute" }, create: { key: "institute", value: data }, update: { value: data } });
      await transaction.auditLog.create({ data: { actorId: user.id, action: "SETTINGS_UPDATED", entityId: "institute" } });
      return { ok: true };
    });
  }
  if (action === "marketing") {
    const user = requirePermission(actor, "marketing.create");
    const data = z.object({ date: z.iso.date(), category: z.enum(marketingCategories), description: z.string().trim().min(2).max(300), amount: money, mode: z.enum(paymentModes), notes: z.string().max(500).default("") }).parse(input);
    return db.$transaction(async transaction => {
      const record = await transaction.marketingExpense.create({ data: { ...data, date: new Date(data.date), addedById: user.id } });
      await transaction.auditLog.create({ data: { actorId: user.id, action: "MARKETING_EXPENSE_CREATED", entityId: record.id } });
      return { id: record.id };
    });
  }
  if (action === "target") {
    const user = requireAdmin(actor); const data = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), amount: money }).parse(input);
    return db.$transaction(async transaction => {
      await transaction.monthlyTarget.upsert({ where: { month: data.month }, create: data, update: { amount: data.amount } });
      await transaction.auditLog.create({ data: { actorId: user.id, action: "TARGET_UPDATED", entityId: data.month, details: { amount: data.amount } } });
      return { ok: true };
    });
  }
  if (action === "resolve") {
    const user = requirePermission(actor, "notifications.view"); const data = z.object({ key: z.string().min(1).max(200) }).parse(input);
    await db.reminderResolution.upsert({ where: { key: `${user.id}:${data.key}` }, create: { key: `${user.id}:${data.key}`, userId: user.id }, update: {} });
    return { ok: true };
  }
  throw new AuthError("Action not found.", 404);
}