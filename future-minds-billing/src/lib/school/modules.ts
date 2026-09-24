import type { Permission } from "@/lib/auth/policy";
export const schoolModules: Record<string, { title: string; view: Permission; create: Permission }> = {
  students: { title: "Students", view: "students.view", create: "students.create" },
  parents: { title: "Parents", view: "parents.view", create: "parents.create" },
  courses: { title: "Courses", view: "courses.view", create: "courses.manage" },
  batches: { title: "Batches", view: "batches.manage", create: "batches.manage" },
};