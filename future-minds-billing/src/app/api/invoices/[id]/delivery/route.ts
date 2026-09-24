import { NextResponse } from "next/server";
import { authResponse, currentUser, readJson, verifyOrigin } from "@/lib/auth/http";
import { requestDelivery } from "@/lib/notifications/delivery";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return authResponse(async () => { verifyOrigin(request); return NextResponse.json(await requestDelivery(await currentUser(), (await context.params).id, await readJson(request)), { status: 202 }); });
}