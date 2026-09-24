import { NextResponse } from "next/server";
import { authResponse, currentUser, readJson, verifyOrigin } from "@/lib/auth/http";
import { managementCommand } from "@/lib/management/service";
export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  return authResponse(async () => { verifyOrigin(request); return NextResponse.json(await managementCommand(await currentUser(), (await context.params).action, await readJson(request))); });
}