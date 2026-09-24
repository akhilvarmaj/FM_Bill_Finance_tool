import { stringify } from "csv-stringify/sync";
export function reportCsv(rows: (string | number)[][]) {
  return stringify(rows, { bom: true, escape_formulas: true, record_delimiter: "\r\n" });
}