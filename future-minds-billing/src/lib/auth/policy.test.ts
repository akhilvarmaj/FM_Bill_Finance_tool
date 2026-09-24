import { describe, expect, it } from "vitest";
import { can, canAccessParentRecord, isAdmin, permissions, type Principal } from "./policy";

const principal: Principal = { id: "parent-1", role: "STAFF", status: "APPROVED", permissions: [] };

describe("authorization", () => {
  it("grants approved administrators every permission", () => {
    for (const permission of permissions) {
      expect(can({ ...principal, role: "ADMIN" }, permission)).toBe(true);
    }
  });
  it("denies staff without an explicit grant", () => {
    expect(can(principal, "invoices.create")).toBe(false);
    expect(can({ ...principal, permissions: ["invoices.create"] }, "invoices.create")).toBe(true);
    expect(can({ ...principal, permissions: ["invoices.create"] }, "invoices.cancel")).toBe(false);
  });
  it.each(["PENDING", "REJECTED", "INACTIVE"] as const)("denies %s accounts including admins", (status) => {
    expect(can({ ...principal, role: "ADMIN", status }, "dashboard.view")).toBe(false);
    expect(isAdmin({ ...principal, role: "ADMIN", status })).toBe(false);
  });
  it("never grants staff capabilities to parents", () => {
    expect(can({ ...principal, role: "PARENT", permissions }, "students.view")).toBe(false);
  });
  it("isolates parent records by authenticated user ID", () => {
    const parent = { ...principal, role: "PARENT" as const };
    expect(canAccessParentRecord(parent, "parent-1")).toBe(true);
    expect(canAccessParentRecord(parent, "parent-2")).toBe(false);
    expect(canAccessParentRecord({ ...parent, status: "INACTIVE" }, "parent-1")).toBe(false);
    expect(canAccessParentRecord(principal, "parent-1")).toBe(false);
  });
});