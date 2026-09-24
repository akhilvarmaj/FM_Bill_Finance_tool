import { NextResponse } from "next/server";
import { authResponse, currentUser, readJson, verifyOrigin } from "@/lib/auth/http";
import { addEnrollment } from "@/lib/school/enrollments";
export async function POST(request: Request) { return authResponse(async () => { verifyOrigin(request); return NextResponse.json(await addEnrollment(await currentUser(), await readJson(request)), { status: 201 }); }); }