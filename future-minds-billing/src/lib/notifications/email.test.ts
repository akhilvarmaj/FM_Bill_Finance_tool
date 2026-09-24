import { afterEach, expect, it, vi } from "vitest";
const transport = vi.hoisted(() => ({ sendMail: vi.fn(), close: vi.fn() }));
vi.mock("nodemailer", () => ({ default: { createTransport: vi.fn(() => transport) } }));
vi.mock("server-only", () => ({}));
import { deliveryFailureStatus, emailConfigured, sendInvoiceEmail } from "./email";
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
it("does not assume timeouts or unknown failures mean the message was rejected", () => {
  expect(deliveryFailureStatus({ code: "ETIMEDOUT" })).toBe("UNKNOWN");
  expect(deliveryFailureStatus(new Error("unknown"))).toBe("UNKNOWN");
  expect(deliveryFailureStatus({ code: "EAUTH" })).toBe("FAILED");
});
it("requires explicit private SMTP configuration", () => {
  vi.stubEnv("SMTP_HOST", "");
  expect(emailConfigured()).toBe(false);
  vi.unstubAllEnvs();
});
it("submits an invoice PDF attachment and closes the SMTP connection", async () => {
  vi.stubEnv("SMTP_HOST", "smtp.example.invalid"); vi.stubEnv("SMTP_PORT", "587"); vi.stubEnv("SMTP_FROM", "billing@example.invalid"); vi.stubEnv("SMTP_USER", "test-user"); vi.stubEnv("SMTP_PASSWORD", "test-only");
  transport.sendMail.mockResolvedValue({ accepted: ["parent@example.invalid"], messageId: "provider-message" });
  expect(await sendInvoiceEmail({ recipient: "parent@example.invalid", subject: "FM-INV-1", message: "Invoice", filename: "FM-INV-1.pdf", pdf: new Uint8Array([37, 80, 68, 70]) })).toBe("provider-message");
  expect(transport.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "parent@example.invalid", attachments: [expect.objectContaining({ filename: "FM-INV-1.pdf", contentType: "application/pdf", content: expect.any(Buffer) })] }));
  expect(transport.close).toHaveBeenCalled();
});