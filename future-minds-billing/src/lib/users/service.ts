import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { permissions, type Principal } from "@/lib/auth/policy";
import { AuthError, requireAdmin } from "@/lib/auth/service";
import { hashPassword } from "@/lib/auth/crypto";
import { emailSchema, passwordSchema } from "@/lib/auth/validation";

export const userSelection = {
  id: true, name: true, email: true, mobile: true, roleName: true,
  status: true, createdAt: true, updatedAt: true,
  permissions: { select: { permissionKey: true } },
} as const;

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(100),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "INACTIVE"]),
  permissions: z.array(z.enum(permissions)).max(permissions.length),
  updatedAt: z.iso.datetime(),
}).strict();

export async function updateUser(actor: Principal | null, id: string, input: unknown) {
  const admin = requireAdmin(actor);
  const data = updateUserSchema.parse(input);
  return db.$transaction(async (transaction) => {
    const target = await transaction.user.findUnique({ where: { id }, select: userSelection });
    if (!target) throw new AuthError("Account not found.", 404);
    if (target.roleName === "ADMIN" && (data.status !== "APPROVED" || data.permissions.length)) {
      throw new AuthError("Administrator access cannot be removed from this screen.", 400);
    }
    if (target.roleName !== "STAFF" && data.permissions.length) {
      throw new AuthError("Only staff accounts can receive individual permissions.", 400);
    }
    const changed = await transaction.user.updateMany({
      where: { id, updatedAt: new Date(data.updatedAt) },
      data: { name: data.name, status: data.status, updatedAt: new Date() },
    });
    if (changed.count !== 1) throw new AuthError("This account changed. Refresh before saving again.", 409);
    await transaction.userPermission.deleteMany({ where: { userId: id } });
    if (data.permissions.length) await transaction.userPermission.createMany({
      data: [...new Set(data.permissions)].map(permissionKey => ({ userId: id, permissionKey })),
    });
    await transaction.session.deleteMany({ where: { userId: id } });
    if (target.roleName === "PARENT") await transaction.parent.updateMany({ where: { userId: id }, data: { name: data.name } });
    await transaction.auditLog.create({ data: {
      actorId: admin.id, action: "USER_ACCESS_UPDATED", entityId: id,
      details: { before: { name: target.name, status: target.status, permissions: target.permissions.map(grant => grant.permissionKey) }, after: { name: data.name, status: data.status, permissions: data.permissions } },
    } });
    return { ok: true };
  });
}

export async function createStaff(actor: Principal | null, input: unknown) {
  const admin = requireAdmin(actor);
  const data = z.object({ name: z.string().trim().min(2).max(100), email: emailSchema, password: passwordSchema }).strict().parse(input);
  const passwordHash = await hashPassword(data.password);
  return db.$transaction(async transaction => {
    const user = await transaction.user.create({ data: { name: data.name, email: data.email, passwordHash, roleName: "STAFF", status: "APPROVED" }, select: { id: true } });
    await transaction.auditLog.create({ data: { actorId: admin.id, action: "STAFF_CREATED", entityId: user.id } });
    return user;
  });
}

export async function resetAccess(actor: Principal | null, id: string, input: unknown) {
  const admin = requireAdmin(actor);
  const { password } = z.object({ password: passwordSchema }).strict().parse(input);
  const passwordHash = await hashPassword(password);
  return db.$transaction(async transaction => {
    const target = await transaction.user.findUnique({ where: { id }, select: { id: true } });
    if (!target) throw new AuthError("Account not found.", 404);
    await transaction.user.update({ where: { id }, data: { passwordHash } });
    await transaction.session.deleteMany({ where: { userId: id } });
    await transaction.auditLog.create({ data: { actorId: admin.id, action: "ACCESS_RESET", entityId: id } });
    return { ok: true };
  });
}