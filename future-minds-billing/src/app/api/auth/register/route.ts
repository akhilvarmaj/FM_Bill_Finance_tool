import { NextResponse } from "next/server";
import { authResponse, readJson, verifyOrigin } from "@/lib/auth/http";
import { register } from "@/lib/auth/service";

export async function POST(request: Request) {
  return authResponse(async () => {
    verifyOrigin(request);
    await register(await readJson(request));
    return NextResponse.json({ message: "Registration received. New accounts require administrator approval before sign-in." }, { status: 202 });
  });
}