import { NextResponse } from "next/server";
import { authResponse, currentUser, readJson, verifyOrigin } from "@/lib/auth/http";
import { cancelInvoice, recordPayment } from "@/lib/billing/service";
import { AuthError } from "@/lib/auth/service";
export async function POST(request: Request, context: { params: Promise<{ id: string; action: string }> }) {
  return authResponse(async () => {
    verifyOrigin(request); const { id, action } = await context.params;
    const user = await currentUser(); const body = await readJson(request);
    if (action === "payment") return NextResponse.json(await recordPayment(user, id, body));
    if (action === "cancel") return NextResponse.json(await cancelInvoice(user, id, body));
    throw new AuthError("Action not found.", 404);
  });
}