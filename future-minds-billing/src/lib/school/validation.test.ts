import { expect, it } from "vitest";
import { money, studentSchema } from "./validation";
const student = { name: "Student One", parentId: "parent", courseId: "course", enrollmentDate: "2026-09-24", paymentPlan: "MONTHLY", fee: "2500", scholarship: "500", discount: "100", billingDay: 1, dueDay: 10 };
it("validates monthly and full-payment enrollment", () => {
  expect(studentSchema.safeParse(student).success).toBe(true);
  expect(studentSchema.safeParse({ ...student, paymentPlan: "ONE_TIME" }).success).toBe(true);
});
it("rejects negative and excessive precision amounts", () => {
  expect(money.safeParse("-1").success).toBe(false);
  expect(money.safeParse("1.001").success).toBe(false);
});
it("rejects scholarship and discount exceeding the fee", () => {
  expect(studentSchema.safeParse({ ...student, discount: "2100" }).success).toBe(false);
});
it("requires a parent, course and valid date order", () => {
  expect(studentSchema.safeParse({ ...student, parentId: "" }).success).toBe(false);
  expect(studentSchema.safeParse({ ...student, courseId: "" }).success).toBe(false);
  expect(studentSchema.safeParse({ ...student, dateOfBirth: "2027-01-01" }).success).toBe(false);
  expect(studentSchema.safeParse({ ...student, dueDay: 0 }).success).toBe(false);
});