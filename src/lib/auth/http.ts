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

function parseHost(val: string | null): string | null {
  if (!val) return null;
  try {
    const raw = val.includes("://") ? new URL(val).host : val;
    return raw.split(",")[0].trim().toLowerCase();
  } catch {
    return val.split(",")[0].trim().toLowerCase();
  }
}

function parseHostname(val: string | null): string | null {
  const host = parseHost(val);
  if (!host) return null;
  return host.split(":")[0];
}

export function verifyOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const xfHost = request.headers.get("x-forwarded-host");
  const rawHost = request.headers.get("host");

  const requestHost = parseHost(xfHost) || parseHost(rawHost);
  const requestHostname = parseHostname(xfHost) || parseHostname(rawHost);

  const clientTarget = origin || referer;
  if (!clientTarget) {
    // If neither origin nor referer is sent (e.g. same-origin direct POST in some browsers), permit
    return;
  }

  const clientHost = parseHost(clientTarget);
  const clientHostname = parseHostname(clientTarget);

  // 1. Exact host match (or without port)
  if (clientHost && requestHost && (clientHost === requestHost || clientHostname === requestHostname)) {
    return;
  }

  // 2. Allowed domain patterns (Vercel, Cloud Run / Google AI Studio preview, localhost)
  if (clientHostname) {
    if (
      clientHostname === "localhost" ||
      clientHostname === "127.0.0.1" ||
      clientHostname.endsWith(".vercel.app") ||
      clientHostname.endsWith(".run.app") ||
      clientHostname.endsWith(".futuremindsco.in")
    ) {
      return;
    }
  }

  // 3. Configured APP_URL or VERCEL_URL
  const appUrl = process.env.APP_URL;
  if (appUrl) {
    const appHost = parseHost(appUrl);
    const appHostname = parseHostname(appUrl);
    if (clientHost === appHost || clientHostname === appHostname) {
      return;
    }
  }

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    const vHost = parseHost(vercelUrl);
    const vHostname = parseHostname(vercelUrl);
    if (clientHost === vHost || clientHostname === vHostname) {
      return;
    }
  }

  throw new AuthError("Cross-site request blocked.", 403);
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