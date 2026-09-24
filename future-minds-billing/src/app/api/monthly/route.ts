import { NextResponse } from "next/server";
import { authResponse, currentUser, verifyOrigin } from "@/lib/auth/http";
import { generateMonthlyInvoices } from "@/lib/billing/monthly";
export async function POST(request: Request) {
  return authResponse(async () => { verifyOrigin(request); return NextResponse.json(await generateMonthlyInvoices(await currentUser())); });
}