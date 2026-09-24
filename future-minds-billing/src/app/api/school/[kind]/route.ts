import { NextResponse } from "next/server";
import { authResponse, currentUser, readJson, verifyOrigin } from "@/lib/auth/http";
import { createSchoolRecord } from "@/lib/school/service";

export async function POST(request: Request, context: { params: Promise<{ kind: string }> }) {
  return authResponse(async () => {
    verifyOrigin(request);
    return NextResponse.json(await createSchoolRecord(await currentUser(), (await context.params).kind, await readJson(request)), { status: 201 });
  });
}