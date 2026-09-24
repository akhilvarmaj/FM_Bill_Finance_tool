import { NextResponse } from "next/server";
import { authResponse, currentUser } from "@/lib/auth/http";
import { AuthError } from "@/lib/auth/service";

export async function GET() {
  return authResponse(async () => {
    const user = await currentUser();
    if (!user) throw new AuthError("Please sign in.", 401);
    return NextResponse.json({ user });
  });
}