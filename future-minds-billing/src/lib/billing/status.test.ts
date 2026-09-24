import { expect, it } from "vitest";
import { collectionStatus } from "./status";
it("separates paid and cancelled invoices from overdue balances", () => {
  expect(collectionStatus("2026-09-01", "2026-09-24", true).key).toBe("paid");
  expect(collectionStatus("2026-09-01", "2026-09-24", false, true).key).toBe("cancelled");
  expect(collectionStatus("2026-09-01", "2026-09-24", false).tone).toBe("danger");
});
it("includes every due date in the next seven days", () => {
  expect(collectionStatus("2026-09-24", "2026-09-24", false).key).toBe("today");
  for (let days = 1; days <= 7; days++) {
    const due = new Date(new Date("2026-09-24").getTime() + days * 86400000).toISOString().slice(0, 10);
    expect(collectionStatus(due, "2026-09-24", false).key).toBe("week");
  }
  expect(collectionStatus("2026-10-02", "2026-09-24", false).key).toBe("upcoming");
});