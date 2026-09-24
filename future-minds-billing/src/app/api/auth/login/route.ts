import { NextResponse } from "next/server";
import { authResponse, cookieOptions, readJson, sessionCookie, verifyOrigin } from "@/lib/auth/http";
import { login } from "@/lib/auth/service";

export async function POST(request: Request) {
  return authResponse(async () => {
    verifyOrigin(request);
    const session = await login(await readJson(request));
    const response = NextResponse.json({ ok: true });
    response.cookies.set(sessionCookie, session.token, { ...cookieOptions, expires: session.expiresAt });
    return response;
  });
}