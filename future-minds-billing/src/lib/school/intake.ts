import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import type { Principal } from "@/lib/auth/policy";
import { requirePermission, AuthError } from "@/lib/auth/service";
import { parentSchema, studentSchema } from "./validation";
export async function billingIntake(actor: Principal | null, input: unknown) {
  const user = requirePermission(actor, "invoices.create");
  requirePermission(user, "students.create"); requirePermission(user, "enrollments.manage");
  const raw = z.object({ parentId: z.string(), parent: z.unknown().optional(), student: z.unknown() }).strict().parse(input);
  const parentData = raw.parentId ? null : parentSchema.parse(raw.parent);
  if (parentData) requirePermission(user, "parents.create");
  const data = studentSchema.parse({ ...(z.record(z.string(), z.unknown()).parse(raw.student)), parentId: raw.parentId || "new-parent" });
  return db.$transaction(async transaction => {
    const course = await transaction.course.findFirst({ where: { id: data.courseId, active: true } });
    if (!course) throw new AuthError("Select an active course.", 400);
    if (data.batchId && !await transaction.batch.findFirst({ where: { id: data.batchId, courseId: course.id, active: true } })) throw new AuthError("Select a batch for this course.", 400);
    let parentId = raw.parentId;
    if (parentData) {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${parentData.mobile}))`;
      if (await transaction.parent.findFirst({ where: { mobile: parentData.mobile, name: { equals: parentData.name, mode: "insensitive" } } })) throw new AuthError("This parent already exists. Choose the existing parent.", 409);
      const parent = await transaction.parent.create({ data: parentData }); parentId = parent.id;
      await transaction.auditLog.create({ data: { actorId: user.id, action: "PARENT_CREATED", entityId: parentId } });
    } else if (!await transaction.parent.findUnique({ where: { id: parentId } })) throw new AuthError("Select an existing parent.", 400);
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${parentId}))`;
    if (await transaction.student.findFirst({ where: { parentId, name: { equals: data.name, mode: "insensitive" }, dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null } })) throw new AuthError("This student already exists. Use their existing enrollment or add a course in Enrollments.", 409);
    const year = data.enrollmentDate.slice(0, 4);
    const sequence = await transaction.numberSequence.upsert({ where: { key: `student-${year}` }, create: { key: `student-${year}`, value: 1 }, update: { value: { increment: 1 } } });
    const student = await transaction.student.create({ data: { name: data.name, studentCode: `FM-STU-${year}-${String(sequence.value).padStart(4, "0")}`, parentId, dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null, grade: data.grade, school: data.school, enrollments: { create: { courseId: data.courseId, batchId: data.batchId || null, enrollmentDate: new Date(data.enrollmentDate), paymentPlan: data.paymentPlan, fee: data.fee, scholarship: data.scholarship, discount: data.discount, billingDay: data.billingDay, dueDay: data.dueDay } } }, include: { enrollments: true } });
    await transaction.auditLog.create({ data: { actorId: user.id, action: "STUDENT_ENROLLED", entityId: student.id } });
    return { enrollmentId: student.enrollments[0].id };
  });
}