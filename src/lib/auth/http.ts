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

export function getCookieOptions(request?: Request) {
  const isHttps = process.env.NODE_ENV === "production" ||
                  process.env.VERCEL === "1" ||
                  request?.headers.get("x-forwarded-proto") === "https";
  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: (isHttps ? "none" : "lax") as "none" | "lax",
    path: "/",
  };
}

export async function currentUser() {
  return findSession((await cookies()).get(sessionCookie)?.value);
}

export function verifyOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const appUrl = process.env.APP_URL;

  if (!origin) {
    if (appUrl) {
      throw new AuthError("Cross-site request blocked.", 403);
    }
    throw new AuthError("Check server configuration.", 500);
  }

  if (host) {
    try {
      const originHost = new URL(origin).host;
      const cleanHost = host.split(",")[0].trim();
      if (originHost === cleanHost || originHost.split(":")[0] === cleanHost.split(":")[0]) {
        return;
      }
    } catch {}
  }

  if (appUrl) {
    try {
      if (new URL(origin).origin === new URL(appUrl).origin) return;
    } catch {}

    try {
      const originHostname = new URL(origin).hostname;
      if (
        originHostname.endsWith(".vercel.app") ||
        originHostname.endsWith(".run.app") ||
        originHostname === "localhost" ||
        originHostname === "127.0.0.1"
      ) {
        return;
      }
    } catch {}

    throw new AuthError("Cross-site request blocked.", 403);
  }

  throw new AuthError("Check server configuration.", 500);
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