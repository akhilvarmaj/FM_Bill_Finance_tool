import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { AuthError, requireAdmin, requirePermission } from "@/lib/auth/service";
import type { Principal } from "@/lib/auth/policy";
import { studentSchema } from "./validation";
export async function addEnrollment(actor: Principal | null, input: unknown) {
  const user = requirePermission(actor, "enrollments.manage");
  const raw = z.object({ studentId: z.string().min(1), courseId: z.string(), batchId: z.string().default(""), enrollmentDate: z.string(), paymentPlan: z.enum(["MONTHLY", "ONE_TIME"]), fee: z.string(), scholarship: z.string(), discount: z.string(), billingDay: z.coerce.number(), dueDay: z.coerce.number() }).parse(input);
  const data = studentSchema.parse({ ...raw, name: "Existing student", parentId: "existing" });
  return db.$transaction(async transaction => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${raw.studentId}))`;
    const student = await transaction.student.findFirst({ where: { id: raw.studentId, active: true } });
    if (!student || !await transaction.course.findFirst({ where: { id: data.courseId, active: true } })) throw new AuthError("Select an active student and course.", 400);
    if (data.batchId && !await transaction.batch.findFirst({ where: { id: data.batchId, courseId: data.courseId, active: true } })) throw new AuthError("Select a batch belonging to the course.", 400);
    const record = await transaction.enrollment.create({ data: { studentId: student.id, courseId: data.courseId, batchId: data.batchId || null, enrollmentDate: new Date(data.enrollmentDate), paymentPlan: data.paymentPlan, fee: data.fee, scholarship: data.scholarship, discount: data.discount, billingDay: data.billingDay, dueDay: data.dueDay } });
    await transaction.auditLog.create({ data: { actorId: user.id, action: "ENROLLMENT_CREATED", entityId: record.id } });
    return { id: record.id };
  });
}
export async function linkParent(actor: Principal | null, input: unknown) {
  const admin = requireAdmin(actor); const data = z.object({ parentId: z.string().min(1), userId: z.string().min(1) }).parse(input);
  return db.$transaction(async transaction => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(64021002)`;
    const user = await transaction.user.findUnique({ where: { id: data.userId }, include: { parent: { include: { _count: { select: { students: true } } } } } });
    const parent = await transaction.parent.findUnique({ where: { id: data.parentId } });
    if (!user || user.roleName !== "PARENT" || !parent) throw new AuthError("Select a parent account and family record.", 400);
    if (parent.userId && parent.userId !== user.id) throw new AuthError("This family is already linked to another account.", 409);
    if (user.parent && user.parent.id !== parent.id) {
      if (user.parent._count.students) throw new AuthError("This account already has children. Family merges require a separate review.", 409);
      await transaction.parent.update({ where: { id: user.parent.id }, data: { userId: null } });
    }
    await transaction.parent.update({ where: { id: parent.id }, data: { userId: user.id } });
    await transaction.session.deleteMany({ where: { userId: user.id } });
    await transaction.auditLog.create({ data: { actorId: admin.id, action: "PARENT_ACCOUNT_LINKED", entityId: parent.id, details: { userId: user.id, previousProfile: user.parent?.id ?? null } } });
    return { ok: true };
  });
}
export async function updateEnrollment(actor: Principal | null, id: string, input: unknown) {
  const user = requirePermission(actor, "enrollments.manage");
  const raw = z.object({ batchId: z.string().default(""), enrollmentDate: z.iso.date(), paymentPlan: z.enum(["MONTHLY", "ONE_TIME"]), fee: z.string(), scholarship: z.string(), discount: z.string(), billingDay: z.coerce.number(), dueDay: z.coerce.number(), active: z.boolean(), updatedAt: z.iso.datetime() }).strict().parse(input);
  const data = studentSchema.parse({ ...raw, name: "Existing student", parentId: "existing", courseId: "existing" });
  return db.$transaction(async transaction => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
    const before = await transaction.enrollment.findUnique({ where: { id }, include: { _count: { select: { invoices: true } } } });
    if (!before) throw new AuthError("Enrollment not found.", 404);
    if (before.updatedAt.toISOString() !== raw.updatedAt) throw new AuthError("Enrollment changed. Reload before saving.", 409);
    if (before._count.invoices && (before.paymentPlan !== data.paymentPlan || before.enrollmentDate.toISOString().slice(0, 10) !== data.enrollmentDate)) throw new AuthError("Plan and start date cannot change after invoicing. Existing invoices remain unchanged.", 409);
    if (data.batchId && !await transaction.batch.findFirst({ where: { id: data.batchId, courseId: before.courseId, active: true } })) throw new AuthError("Select an active batch belonging to this course.", 400);
    const changes = { batchId: data.batchId || null, enrollmentDate: new Date(data.enrollmentDate), paymentPlan: data.paymentPlan, fee: data.fee, scholarship: data.scholarship, discount: data.discount, billingDay: data.billingDay, dueDay: data.dueDay, active: raw.active };
    const updated = await transaction.enrollment.updateMany({ where: { id, updatedAt: new Date(raw.updatedAt) }, data: changes });
    if (!updated.count) throw new AuthError("Enrollment changed. Reload before saving.", 409);
    await transaction.auditLog.create({ data: { actorId: user.id, action: "ENROLLMENT_UPDATED", entityId: id, details: { before: { fee: before.fee.toString(), scholarship: before.scholarship.toString(), discount: before.discount.toString(), active: before.active, batchId: before.batchId, paymentPlan: before.paymentPlan, billingDay: before.billingDay, dueDay: before.dueDay, enrollmentDate: before.enrollmentDate.toISOString() }, after: { ...changes, enrollmentDate: data.enrollmentDate } } } });
    return { id };
  });
}