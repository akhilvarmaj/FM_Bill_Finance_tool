import "server-only";
import nodemailer from "nodemailer";
import { z } from "zod";
const configuration = z.object({ host: z.string().min(1), port: z.coerce.number().int().min(1).max(65535), from: z.email(), user: z.string().min(1), password: z.string().min(1) });
function smtpConfiguration() {
  return configuration.safeParse({ host: process.env.SMTP_HOST, port: process.env.SMTP_PORT ?? "587", from: process.env.SMTP_FROM, user: process.env.SMTP_USER, password: process.env.SMTP_PASSWORD });
}
export function emailConfigured() { return smtpConfiguration().success; }
export async function sendInvoiceEmail(input: { recipient: string; subject: string; message: string; filename: string; pdf: Uint8Array }) {
  const parsed = smtpConfiguration(); if (!parsed.success) throw Object.assign(new Error("Email provider is not configured."), { code: "NOT_CONFIGURED" });
  const settings = parsed.data;
  const transport = nodemailer.createTransport({ host: settings.host, port: settings.port, secure: settings.port === 465, requireTLS: settings.port !== 465, auth: { user: settings.user, pass: settings.password }, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000, disableFileAccess: true, disableUrlAccess: true });
  try {
    const result = await transport.sendMail({ from: settings.from, to: z.email().parse(input.recipient), subject: input.subject, text: input.message, attachments: [{ filename: input.filename, content: Buffer.from(input.pdf), contentType: "application/pdf" }] });
    if (!result.accepted.length) throw Object.assign(new Error("Recipient rejected."), { code: "EENVELOPE" });
    return String(result.messageId);
  } finally { transport.close(); }
}
export function deliveryFailureStatus(error: unknown): "FAILED" | "UNKNOWN" {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  return ["NOT_CONFIGURED", "EAUTH", "EENVELOPE", "ECONNECTION", "EDNS"].includes(code) ? "FAILED" : "UNKNOWN";
}