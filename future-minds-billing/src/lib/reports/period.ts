import { z } from "zod";
export const presets = ["Today", "This Week", "This Month", "Last Month", "This Quarter", "This Year", "Calendar Year", "Financial Year", "Custom"] as const;
export function reportPeriod(input: { period?: string; from?: string; to?: string; year?: string }, now = new Date()) {
  const today = new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now)}T00:00:00Z`);
  const year = today.getUTCFullYear(); const month = today.getUTCMonth();
  const period = presets.includes(input.period as typeof presets[number]) ? input.period as typeof presets[number] : "This Month";
  let from = new Date(Date.UTC(year, month, 1)); let to = today;
  if (period === "Today") from = today;
  if (period === "This Week") from = new Date(today.getTime() - ((today.getUTCDay() + 6) % 7) * 86400000);
  if (period === "Last Month") { from = new Date(Date.UTC(year, month - 1, 1)); to = new Date(Date.UTC(year, month, 0)); }
  if (period === "This Quarter") from = new Date(Date.UTC(year, Math.floor(month / 3) * 3, 1));
  if (period === "This Year") from = new Date(Date.UTC(year, 0, 1));
  if (period === "Calendar Year") {
    const selected = /^\d{4}$/.test(input.year ?? "") && Number(input.year) >= 2000 && Number(input.year) <= 2100 ? Number(input.year) : year;
    from = new Date(Date.UTC(selected, 0, 1)); to = new Date(Date.UTC(selected, 11, 31));
  }
  if (period === "Financial Year") from = new Date(Date.UTC(month < 3 ? year - 1 : year, 3, 1));
  if (period === "Custom" && z.iso.date().safeParse(input.from).success && z.iso.date().safeParse(input.to).success) {
    from = new Date(input.from!); to = new Date(input.to!);
    if (from > to) [from, to] = [to, from];
  }
  return { period, from, to };
}