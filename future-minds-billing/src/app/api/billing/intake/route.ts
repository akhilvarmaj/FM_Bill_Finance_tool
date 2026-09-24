import { NextResponse } from "next/server";
import { authResponse, currentUser, readJson, verifyOrigin } from "@/lib/auth/http";
import { billingIntake } from "@/lib/school/intake";
export async function POST(request: Request) {
  return authResponse(async () => { verifyOrigin(request); return NextResponse.json(await billingIntake(await currentUser(), await readJson(request)), { status: 201 }); });
}