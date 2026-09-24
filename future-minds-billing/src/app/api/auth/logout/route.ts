import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authResponse, cookieOptions, sessionCookie, verifyOrigin } from "@/lib/auth/http";
import { logout } from "@/lib/auth/service";

export async function POST(request: Request) {
  return authResponse(async () => {
    verifyOrigin(request);
    await logout((await cookies()).get(sessionCookie)?.value);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(sessionCookie, "", { ...cookieOptions, maxAge: 0 });
    return response;
  });
}