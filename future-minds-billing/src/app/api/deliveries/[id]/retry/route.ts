import { NextResponse } from "next/server";
import { authResponse, currentUser, verifyOrigin } from "@/lib/auth/http";
import { retryDelivery } from "@/lib/notifications/delivery";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return authResponse(async () => { verifyOrigin(request); return NextResponse.json(await retryDelivery(await currentUser(), (await context.params).id)); });
}