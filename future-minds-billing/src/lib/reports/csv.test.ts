import { expect, it } from "vitest";
import { reportCsv } from "./csv";
it("escapes CSV delimiters, quotes and spreadsheet formulas", () => {
  const output = reportCsv([["Name", "Amount"], ["Parent, One", 25], ['=HYPERLINK("bad")', 0]]);
  expect(output).toContain('"Parent, One",25');
  expect(output).toContain("'=HYPERLINK");
  expect(output.charCodeAt(0)).toBe(0xfeff);
});