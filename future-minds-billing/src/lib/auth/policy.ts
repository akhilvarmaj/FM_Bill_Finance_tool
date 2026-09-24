export const permissions = [
  "students.view", "students.create", "students.edit",
  "parents.view", "parents.create", "parents.edit",
  "courses.view", "courses.manage", "batches.manage", "enrollments.manage",
  "invoices.view", "invoices.create", "invoices.edit", "invoices.cancel",
  "payments.view", "payments.create", "whatsapp.send", "dashboard.view",
  "reports.sales", "reports.courses", "reports.payments", "reports.marketing",
  "marketing.view", "marketing.create", "notifications.view",
] as const;

export type Permission = (typeof permissions)[number];
export type Role = "ADMIN" | "STAFF" | "PARENT";
export type AccountStatus = "PENDING" | "APPROVED" | "REJECTED" | "INACTIVE";
export type Principal = {
  id: string;
  role: Role;
  status: AccountStatus;
  permissions: readonly string[];
};

export function can(principal: Principal, permission: Permission): boolean {
  if (principal.status !== "APPROVED") return false;
  if (principal.role === "ADMIN") return true;
  return principal.role === "STAFF" && principal.permissions.includes(permission);
}

export function canAccessParentRecord(principal: Principal, ownerUserId: string): boolean {
  return principal.status === "APPROVED" &&
    principal.role === "PARENT" && principal.id === ownerUserId;
}

export function isAdmin(principal: Principal): boolean {
  return principal.status === "APPROVED" && principal.role === "ADMIN";
}