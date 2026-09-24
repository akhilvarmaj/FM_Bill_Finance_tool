import "server-only";
import { db } from "@/lib/db";
import { AuthError, requirePermission } from "@/lib/auth/service";
import type { Principal } from "@/lib/auth/policy";
import { batchSchema, courseSchema, parentSchema, studentSchema } from "./validation";
import { z } from "zod";

export async function updateSchoolRecord(actor: Principal | null, kind: string, id: string, input: unknown) {
  const permission = ({ courses: "courses.manage", parents: "parents.edit", batches: "batches.manage", students: "students.edit" } as const)[kind as "courses" | "parents" | "batches" | "students"];
  if (!permission) throw new AuthError("Module not found.", 404);
  const user = requirePermission(actor, permission);
  return db.$transaction(async transaction => {
    if (kind === "courses") await transaction.course.update({ where: { id }, data: courseSchema.parse(input) });
    else if (kind === "parents") {
      const data = parentSchema.parse(input);
      const parent = await transaction.parent.update({ where: { id }, data });
      if (parent.userId) await transaction.user.update({ where: { id: parent.userId }, data: { name: data.name, mobile: data.mobile } });
    } else if (kind === "batches") {
      const data = batchSchema.omit({ courseId: true }).parse(input);
      await transaction.batch.update({ where: { id }, data });
    } else {
      const data = z.object({ name: z.string().trim().min(2).max(100), grade: z.string().max(100), school: z.string().max(300), active: z.boolean() }).strict().parse(input);
      await transaction.student.update({ where: { id }, data });
    }
    await transaction.auditLog.create({ data: { actorId: user.id, action: `${kind.toUpperCase()}_UPDATED`, entityId: id } });
    return { id };
  });
}

export async function createSchoolRecord(actor: Principal | null, kind: string, input: unknown) {
  if (kind === "courses") {
    const user = requirePermission(actor, "courses.manage"); const data = courseSchema.parse(input);
    return db.$transaction(async transaction => {
      const record = await transaction.course.create({ data });
      await transaction.auditLog.create({ data: { actorId: user.id, action: "COURSE_CREATED", entityId: record.id } });
      return { id: record.id };
    });
  }
  if (kind === "parents") {
    const user = requirePermission(actor, "parents.create"); const data = parentSchema.parse(input);
    return db.$transaction(async transaction => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${data.mobile}))`;
      if (await transaction.parent.findFirst({ where: { mobile: data.mobile, name: { equals: data.name, mode: "insensitive" } } })) throw new AuthError("This parent already exists. Select the existing record.", 409);
      const record = await transaction.parent.create({ data });
      await transaction.auditLog.create({ data: { actorId: user.id, action: "PARENT_CREATED", entityId: record.id } });
      return { id: record.id };
    });
  }
  if (kind === "batches") {
    const user = requirePermission(actor, "batches.manage"); const data = batchSchema.parse(input);
    return db.$transaction(async transaction => {
      if (!await transaction.course.findFirst({ where: { id: data.courseId, active: true } })) throw new AuthError("Select an active course.", 400);
      const record = await transaction.batch.create({ data });
      await transaction.auditLog.create({ data: { actorId: user.id, action: "BATCH_CREATED", entityId: record.id } });
      return { id: record.id };
    });
  }
  if (kind !== "students") throw new AuthError("Module not found.", 404);
  const user = requirePermission(actor, "students.create"); const data = studentSchema.parse(input);
  return db.$transaction(async transaction => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${data.parentId}))`;
    const parent = await transaction.parent.findUnique({ where: { id: data.parentId } });
    const course = await transaction.course.findFirst({ where: { id: data.courseId, active: true } });
    if (!parent || !course) throw new AuthError("Select an existing parent and active course.", 400);
    if (data.batchId && !await transaction.batch.findFirst({ where: { id: data.batchId, courseId: data.courseId, active: true } })) throw new AuthError("The batch does not belong to this course.", 400);
    if (await transaction.student.findFirst({ where: { parentId: data.parentId, name: { equals: data.name, mode: "insensitive" }, dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null } })) throw new AuthError("This student already exists for the selected parent.", 409);
    const year = new Date(data.enrollmentDate).getUTCFullYear();
    const sequence = await transaction.numberSequence.upsert({ where: { key: `student-${year}` }, create: { key: `student-${year}`, value: 1 }, update: { value: { increment: 1 } } });
    const record = await transaction.student.create({ data: {
      studentCode: `FM-STU-${year}-${String(sequence.value).padStart(4, "0")}`, name: data.name, parentId: data.parentId,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null, grade: data.grade, school: data.school,
      enrollments: { create: { courseId: data.courseId, batchId: data.batchId || null, enrollmentDate: new Date(data.enrollmentDate), paymentPlan: data.paymentPlan, fee: data.fee, scholarship: data.scholarship, discount: data.discount, billingDay: data.billingDay, dueDay: data.dueDay } },
    } });
    await transaction.auditLog.create({ data: { actorId: user.id, action: "STUDENT_ENROLLED", entityId: record.id } });
    return { id: record.id };
  });
}