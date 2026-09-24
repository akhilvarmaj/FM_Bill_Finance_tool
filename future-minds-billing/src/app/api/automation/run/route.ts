import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { authResponse, currentUser, verifyOrigin } from "@/lib/auth/http";
import { AuthError, requireAdmin } from "@/lib/auth/service";
import { runAutomation } from "@/lib/automation/service";
import { enqueueEmailReminders, processEmailQueue } from "@/lib/notifications/delivery";
export async function POST(request: Request) {
  return authResponse(async () => {
    const header = request.headers.get("authorization");
    if (header) {
      const secret = process.env.JOB_SECRET;
      if (!secret || secret.length < 32 || !timingSafeEqual(createHash("sha256").update(header).digest(), createHash("sha256").update(`Bearer ${secret}`).digest())) throw new AuthError("Unauthorized job request.", 401);
      return NextResponse.json({ ...await runAutomation(), reminders: await enqueueEmailReminders(), email: await processEmailQueue() });
    }
    verifyOrigin(request); requireAdmin(await currentUser());
    return NextResponse.json({ ...await runAutomation(true), reminders: await enqueueEmailReminders(), email: await processEmailQueue() });
  });
}