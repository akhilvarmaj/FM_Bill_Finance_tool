import { expect, it } from "vitest";
import { clickToChat, reminderStage } from "./whatsapp";
it("normalizes Indian numbers and encodes message contents", () => {
  expect(clickToChat.compose("98765 43210", "Hello & welcome")).toBe("https://wa.me/919876543210?text=Hello%20%26%20welcome");
  expect(() => clickToChat.compose("123", "Hello")).toThrow();
});
it("classifies all reminder stages", () => {
  const today = new Date("2026-09-01");
  expect(reminderStage(new Date("2026-09-08"), today)).toBe("7-day reminder");
  expect(reminderStage(new Date("2026-09-04"), today)).toBe("3-day reminder");
  expect(reminderStage(new Date("2026-09-02"), today)).toBe("Due tomorrow");
  expect(reminderStage(today, today)).toBe("Due today");
  expect(reminderStage(new Date("2026-08-31"), today)).toBe("Overdue");
});