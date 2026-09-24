import { NextResponse } from "next/server";
import { authResponse, currentUser, readJson, verifyOrigin } from "@/lib/auth/http";
import { updateEnrollment } from "@/lib/school/enrollments";
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return authResponse(async () => { verifyOrigin(request); return NextResponse.json(await updateEnrollment(await currentUser(), (await context.params).id, await readJson(request))); });
}