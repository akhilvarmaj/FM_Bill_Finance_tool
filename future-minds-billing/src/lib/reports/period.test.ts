it("supports complete selected calendar years", () => {
  const range = reportPeriod({ period: "Calendar Year", year: "2024" });
  expect(range.from.toISOString().slice(0, 10)).toBe("2024-01-01");
  expect(range.to.toISOString().slice(0, 10)).toBe("2024-12-31");
});
import { expect, it } from "vitest";
import { reportPeriod } from "./period";
it("uses April financial years and calendar quarter boundaries", () => {
  expect(reportPeriod({ period: "Financial Year" }, new Date("2026-02-10T10:00:00Z")).from.toISOString().slice(0, 10)).toBe("2025-04-01");
  expect(reportPeriod({ period: "This Quarter" }, new Date("2026-09-24T10:00:00Z")).from.toISOString().slice(0, 10)).toBe("2026-07-01");
});
it("handles previous month and reversed custom ranges", () => {
  expect(reportPeriod({ period: "Last Month" }, new Date("2026-03-10T10:00:00Z")).to.toISOString().slice(0, 10)).toBe("2026-02-28");
  expect(reportPeriod({ period: "Custom", from: "2026-09-30", to: "2026-09-01" }).from.toISOString().slice(0, 10)).toBe("2026-09-01");
});