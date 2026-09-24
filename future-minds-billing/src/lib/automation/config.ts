import { z } from "zod";
export const automationSchema = z.object({ active: z.boolean().default(false), emailReminders: z.boolean().default(false), hour: z.coerce.number().int().min(0).max(23).default(8), reminderDays: z.string().default("7,3,1,0").refine(value => value.split(",").length <= 16 && value.split(",").every(day => /^\d{1,2}$/.test(day.trim()) && Number(day) <= 60), "Use comma-separated days from 0 to 60."), actorId: z.string().default("") });
export function scheduledHourReached(hour: number, now = new Date()) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hourCycle: "h23" }).format(now)) >= hour;
}