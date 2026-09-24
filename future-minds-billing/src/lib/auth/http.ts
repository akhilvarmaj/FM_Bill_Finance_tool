import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AuthError, findSession } from "./service";

export const sessionCookie = "fm-session";
export const cookieOptions = {
  httpOnly: true, secure: true, sameSite: "none" as const, path: "/",
};

export async function currentUser() {
  return findSession((await cookies()).get(sessionCookie)?.value);
}

export function verifyOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const appUrl = process.env.APP_URL;
  if (appUrl) {
    try {
      if (new URL(origin).origin === new URL(appUrl).origin) return;
    } catch {}
  }
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (host) {
    try {
      if (new URL(origin).host === host) return;
    } catch {}
  }
}

export async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    throw new AuthError("Please submit a valid form.", 415);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new AuthError("Please complete the form.", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 8192) {
      await reader.cancel();
      throw new AuthError("The submitted form is too large.", 413);
    }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new AuthError("Please submit a valid form.", 400); }
}

export async function authResponse(operation: () => Promise<NextResponse>) {
  try {
    const response = await operation();
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    let status = 503;
    let message = "Service temporarily unavailable. Please contact your administrator.";
    if (error instanceof AuthError) { status = error.status; message = error.message; }
    else if (error instanceof ZodError) { status = 400; message = error.issues[0]?.message ?? "Check your details."; }
    else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      status = 409; message = "This request conflicts with an existing record.";
    }
    return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}