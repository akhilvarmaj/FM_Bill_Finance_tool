import { expect, it } from "vitest";
import { automationSchema, scheduledHourReached } from "./config";
it("defaults billing automation off and validates reminder offsets", () => {
  expect(automationSchema.parse({}).active).toBe(false);
  expect(automationSchema.safeParse({ reminderDays: "7,3,1,0" }).success).toBe(true);
  expect(automationSchema.safeParse({ reminderDays: "-1,200" }).success).toBe(false);
});
it("runs on the configured India-local hour", () => {
  expect(scheduledHourReached(8, new Date("2026-09-24T02:29:00Z"))).toBe(false);
  expect(scheduledHourReached(8, new Date("2026-09-24T02:30:00Z"))).toBe(true);
});