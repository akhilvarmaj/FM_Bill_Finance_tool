import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authResponse, getCookieOptions, sessionCookie, verifyOrigin } from "@/lib/auth/http";
import { logout } from "@/lib/auth/service";

export async function POST(request: Request) {
  return authResponse(async () => {
    verifyOrigin(request);
    await logout((await cookies()).get(sessionCookie)?.value);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(sessionCookie, "", { ...getCookieOptions(request), maxAge: 0 });
    return response;
  });
}