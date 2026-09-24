import { z } from "zod";
import { Prisma } from "@prisma/client";

export const money = z.string().regex(/^\d{1,9}(\.\d{1,2})?$/, "Enter a valid amount with at most two decimal places.");
const name = z.string().trim().min(2).max(100);
const optional = z.string().trim().max(500).default("");
export const courseSchema = z.object({ name, description: optional, duration: z.coerce.number().int().min(1).max(120), monthlyFee: money, fullFee: money, active: z.boolean().default(true) });
export const parentSchema = z.object({ name, mobile: z.string().regex(/^\+?[0-9 ()-]{8,20}$/), whatsapp: optional, email: z.union([z.email(), z.literal("")]).default(""), address: z.string().trim().min(5).max(500), city: optional, state: optional, pincode: optional });
export const batchSchema = z.object({ name, courseId: z.string().min(1), schedule: z.string().trim().min(2).max(300), active: z.boolean().default(true) });
export const studentSchema = z.object({
  name, parentId: z.string().min(1, "Please select a parent."), courseId: z.string().min(1, "Please select a course."),
  batchId: z.string().default(""), dateOfBirth: z.union([z.iso.date(), z.literal("")]).default(""), grade: optional, school: optional,
  enrollmentDate: z.iso.date(), paymentPlan: z.enum(["MONTHLY", "ONE_TIME"]),
  fee: money, scholarship: money, discount: money,
  billingDay: z.coerce.number().int().min(1).max(28), dueDay: z.coerce.number().int().min(1).max(28),
}).superRefine((data, context) => {
  if (new Prisma.Decimal(data.scholarship).plus(data.discount).greaterThan(data.fee)) context.addIssue({ code: "custom", path: ["discount"], message: "Scholarship and discount cannot exceed the fee." });
  if (data.dueDay < data.billingDay) context.addIssue({ code: "custom", path: ["dueDay"], message: "Due day must be on or after billing day." });
  if (data.dateOfBirth && data.dateOfBirth > data.enrollmentDate) context.addIssue({ code: "custom", path: ["dateOfBirth"], message: "Date of birth must be before enrollment." });
});