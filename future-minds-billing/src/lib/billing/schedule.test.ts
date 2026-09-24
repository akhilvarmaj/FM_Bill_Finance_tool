import { expect, it } from "vitest";
import { monthlySchedule } from "./schedule";
it("tracks finite monthly terms across year boundaries", () => {
  const schedule = monthlySchedule(new Date("2026-12-24"), 3, 1, 10);
  expect(schedule.map(item => item.period)).toEqual(["2026-12", "2027-01", "2027-02"]);
  expect(schedule[0].invoiceDate).toBe("2026-12-24"); expect(schedule[0].dueDate).toBe("2026-12-24");
  expect(schedule[1].dueDate).toBe("2027-01-10");
});