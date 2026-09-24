import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AuthError, findSession } from "./service";

export const sessionCookie = process.env.NODE_ENV === "production" ? "__Host-fm-session" : "fm-session";
export const cookieOptions = {
  httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/",
};

export async function currentUser() {
  return findSession((await cookies()).get(sessionCookie)?.value);
}

export function verifyOrigin(request: Request) {
  const appUrl = process.env.APP_URL;
  if (!appUrl) throw new AuthError("Application configuration is unavailable. Contact your administrator.", 503);
  if (request.headers.get("origin") !== new URL(appUrl).origin) {
    throw new AuthError("This request could not be verified. Please refresh and try again.", 403);
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