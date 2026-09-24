import { NextResponse } from "next/server";
import { authResponse, currentUser, readJson, verifyOrigin } from "@/lib/auth/http";
import { resetAccess, updateUser } from "@/lib/users/service";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return authResponse(async () => {
    verifyOrigin(request);
    return NextResponse.json(await updateUser(await currentUser(), (await context.params).id, await readJson(request)));
  });
}
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return authResponse(async () => {
    verifyOrigin(request);
    return NextResponse.json(await resetAccess(await currentUser(), (await context.params).id, await readJson(request)));
  });
}