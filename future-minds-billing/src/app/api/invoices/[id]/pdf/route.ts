import { NextResponse } from "next/server";
import { authResponse, currentUser } from "@/lib/auth/http";
import { accessibleInvoice } from "@/lib/billing/service";
import { invoicePdf } from "@/lib/billing/pdf";
import { instituteSettings } from "@/lib/management/service";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return authResponse(async () => {
    const invoice = await accessibleInvoice(await currentUser(), (await context.params).id);
    const pdf = await invoicePdf(invoice, await instituteSettings());
    return new NextResponse(Buffer.from(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${invoice.number}.pdf"` } });
  });
}