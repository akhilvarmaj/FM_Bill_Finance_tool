import { NextResponse } from "next/server";
import { authResponse, currentUser, readJson, verifyOrigin } from "@/lib/auth/http";
import { updateSchoolRecord } from "@/lib/school/service";

export async function PATCH(request: Request, context: { params: Promise<{ kind: string; id: string }> }) {
  return authResponse(async () => {
    verifyOrigin(request);
    const { kind, id } = await context.params;
    return NextResponse.json(await updateSchoolRecord(await currentUser(), kind, id, await readJson(request)));
  });
}