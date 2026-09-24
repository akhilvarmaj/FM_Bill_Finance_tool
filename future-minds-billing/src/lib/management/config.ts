import { z } from "zod";
export const instituteSchema = z.object({
  name: z.string().trim().min(2).max(100).default("Future Minds"),
  address: z.string().trim().max(400).default(""), phone: z.string().max(30).default(""),
  email: z.union([z.email(), z.literal("")]).default(""), website: z.string().max(150).default(""), gstin: z.string().max(30).default(""),
  invoicePrefix: z.string().regex(/^[A-Z0-9-]{2,15}$/).default("FM-INV"),
  paymentTerms: z.coerce.number().int().min(0).max(90).default(10),
});
export const marketingCategories = ["Google Ads", "Meta Ads", "Flyers", "Posters", "Events", "Promotions", "School Outreach", "Referral", "Other"] as const;