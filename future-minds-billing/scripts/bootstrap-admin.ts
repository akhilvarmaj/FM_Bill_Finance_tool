import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { hashPassword } from "../src/lib/auth/crypto";
import { permissions } from "../src/lib/auth/policy";
import { emailSchema, passwordSchema } from "../src/lib/auth/validation";

const db = new PrismaClient();

async function main() {
  const config = z.object({
    BOOTSTRAP_ADMIN_EMAIL: emailSchema,
    BOOTSTRAP_ADMIN_NAME: z.string().trim().min(2).max(100),
    BOOTSTRAP_ADMIN_PASSWORD: passwordSchema,
  }).parse(process.env);
  const passwordHash = await hashPassword(config.BOOTSTRAP_ADMIN_PASSWORD);
  await db.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(64021001)`;
    if (await transaction.user.findFirst({ where: { roleName: "ADMIN" } })) {
      throw new Error("An administrator already exists; bootstrap will not reset or replace it.");
    }
    for (const name of ["ADMIN", "STAFF", "PARENT"] as const) {
      await transaction.role.upsert({ where: { name }, create: { name }, update: {} });
    }
    for (const key of permissions) {
      await transaction.permission.upsert({ where: { key }, create: { key }, update: {} });
    }
    const admin = await transaction.user.create({ data: {
      email: config.BOOTSTRAP_ADMIN_EMAIL, name: config.BOOTSTRAP_ADMIN_NAME,
      passwordHash, roleName: "ADMIN", status: "APPROVED",
    } });
    await transaction.auditLog.create({ data: { actorId: admin.id, action: "ADMIN_BOOTSTRAPPED", entityId: admin.id } });
  });
  console.info("Initial administrator created. Remove BOOTSTRAP_ADMIN_PASSWORD from your environment.");
}

main().catch((error: unknown) => {
  console.error(error instanceof z.ZodError
    ? "Set a valid bootstrap email, name, and password of at least 12 characters in the environment."
    : "Administrator setup failed. Verify database access, migrations, and whether an administrator already exists.");
  process.exitCode = 1;
}).finally(() => db.$disconnect());