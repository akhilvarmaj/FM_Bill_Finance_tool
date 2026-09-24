import { NextResponse } from "next/server";
import { authResponse, currentUser, readJson, verifyOrigin } from "@/lib/auth/http";
import { createStaff } from "@/lib/users/service";

export async function POST(request: Request) {
  return authResponse(async () => {
    verifyOrigin(request);
    return NextResponse.json(await createStaff(await currentUser(), await readJson(request)), { status: 201 });
  });
}