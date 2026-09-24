import { z } from "zod";

export const emailSchema = z.email().trim().toLowerCase().max(254);
export const passwordSchema = z.string().min(12, "Use at least 12 characters.").max(128);
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
export const registrationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(["STAFF", "PARENT"]),
  mobile: z.string().trim().regex(/^\+?[0-9 ()-]{8,20}$/, "Enter a valid mobile number."),
  address: z.string().trim().max(500),
}).superRefine((input, context) => {
  if (input.role === "PARENT" && input.address.length < 5) {
    context.addIssue({ code: "custom", path: ["address"], message: "Enter your address." });
  }
});