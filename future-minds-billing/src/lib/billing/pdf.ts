import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { ToWords } from "to-words";
import { Prisma } from "@prisma/client";
import type { accessibleInvoice } from "./service";
import type { instituteSettings } from "@/lib/management/service";
import { invoiceStatus } from "./rules";
import sharp from "sharp";

export async function invoicePdf(invoice: Awaited<ReturnType<typeof accessibleInvoice>>, institute: Awaited<ReturnType<typeof instituteSettings>>) {
  const document = await PDFDocument.create(); document.registerFontkit(fontkit);
  const font = await document.embedFont(await readFile(path.join(process.cwd(), "public", "NotoSans-Regular.ttf")), { subset: true });
  let page = document.addPage([595.28, 841.89]); let cursor = 790;
  const logo = await document.embedPng(await sharp(await readFile(path.join(process.cwd(), "public", "future-minds-logo.svg"))).resize(128, 128).png().toBuffer());
  const ink = rgb(0.055, 0.176, 0.357), muted = rgb(0.38, 0.45, 0.55), border = rgb(0.84, 0.88, 0.94);
  const green = rgb(0.07, 0.46, 0.33), red = rgb(0.75, 0.16, 0.25);
  function text(value: string, left: number, top: number, size = 9, color = ink) {
    page.drawText(value, { x: left, y: top, size, font, color });
  }
  function wrap(value: string, width: number, size = 9) {
    const lines: string[] = [];
    for (const paragraph of value.split(/\r?\n/)) {
      let current = "";
      for (const character of paragraph) {
        if (font.widthOfTextAtSize(current + character, size) > width) { lines.push(current); current = character; }
        else current += character;
      }
      lines.push(current);
    }
    return lines;
  }
  function rule(top: number) { page.drawLine({ start: { x: 42, y: top }, end: { x: 553, y: top }, thickness: 0.6, color: border }); }
  function space(height: number) {
    if (cursor - height < 55) { page = document.addPage([595.28, 841.89]); text(`${invoice.number} / continued`, 42, 797, 9, muted); cursor = 765; }
  }
  function paragraph(value: string, size = 9, color = ink) {
    for (const row of wrap(value, 511, size)) { space(size + 7); text(row, 42, cursor, size, color); cursor -= size + 7; }
  }
  function amount(label: string, value: string, color = ink) {
    space(25); text(label, 325, cursor, 9, color);
    const formatted = `INR ${value}`;
    text(formatted, 553 - font.widthOfTextAtSize(formatted, 10), cursor, 10, color); cursor -= 25;
  }
  const paid = invoice.payments.reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0));
  page.drawImage(logo, { x: 42, y: 755, width: 44, height: 44 });
  const nameLines = wrap(institute.name, 300, 19);
  nameLines.forEach((row, index) => text(row, 98, 783 - index * 24, 19));
  text("ROBOTICS / AI / CODING", 98, 763 - (nameLines.length - 1) * 24, 8, muted);
  page.drawRectangle({ x: 423, y: 765, width: 130, height: 32, color: ink });
  text("FEE BILL / RECEIPT", 435, 778, 9, rgb(1, 1, 1));
  cursor = 735 - (nameLines.length - 1) * 24;
  if (institute.address) paragraph(institute.address, 8, muted);
  paragraph([institute.phone, institute.email, institute.website].filter(Boolean).join(" | "), 8, muted);
  if (institute.gstin) paragraph(`GSTIN: ${institute.gstin}`, 8, muted);
  cursor -= 8; rule(cursor); cursor -= 24;
  paragraph(invoice.number, 14);
  paragraph(`Date: ${invoice.invoiceDate.toISOString().slice(0, 10)}    Due: ${invoice.dueDate.toISOString().slice(0, 10)}    ${invoiceStatus(invoice.total, paid, !!invoice.cancelledAt)}`, 9, muted);
  cursor -= 12;
  const studentLines = ["STUDENT DETAILS", invoice.studentName, invoice.studentCode, `Course: ${invoice.courseName}`, `Cycle: ${invoice.periodKey}`].flatMap(value => wrap(value, 225));
  const parentLines = ["GUARDIAN DETAILS", invoice.parentName, invoice.parentAddress, invoice.paymentPlan === "MONTHLY" ? "Monthly fees" : "One-time / Full course"].flatMap(value => wrap(value, 225));
  const panelHeight = Math.max(studentLines.length, parentLines.length) * 15 + 24;
  space(panelHeight);
  page.drawRectangle({ x: 42, y: cursor - panelHeight + 12, width: 511, height: panelHeight, color: rgb(0.97, 0.98, 1), borderColor: border, borderWidth: 0.6 });
  studentLines.forEach((row, index) => text(row, 56, cursor - 8 - index * 15, index === 0 ? 8 : 9, index === 0 ? muted : ink));
  parentLines.forEach((row, index) => text(row, 316, cursor - 8 - index * 15, index === 0 ? 8 : 9, index === 0 ? muted : ink));
  cursor -= panelHeight + 20;
  function tableHeader() { space(32); text("NO.", 48, cursor, 8, muted); text("PARTICULARS / DESCRIPTION", 85, cursor, 8, muted); text("AMOUNT (INR)", 468, cursor, 8, muted); cursor -= 12; rule(cursor); cursor -= 20; }
  tableHeader();
  for (const [index, item] of invoice.items.entries()) {
    const rows = wrap(item.description, 345);
    if (cursor - rows.length * 15 - 18 < 55) { space(rows.length * 15 + 50); tableHeader(); }
    text(String(index + 1).padStart(2, "0"), 48, cursor, 9, muted);
    text(item.amount.toFixed(2), 553 - font.widthOfTextAtSize(item.amount.toFixed(2), 9), cursor);
    for (const row of rows) { space(15); text(row, 85, cursor); cursor -= 15; }
    cursor -= 8; rule(cursor); cursor -= 20;
  }
  space(95);
  amount("Total fee", invoice.total.toFixed(2));
  amount("Amount paid", paid.toFixed(2), green);
  amount("Outstanding balance", invoice.cancelledAt ? "0.00" : invoice.total.minus(paid).toFixed(2), invoice.cancelledAt || paid.greaterThanOrEqualTo(invoice.total) ? green : red);
  paragraph("AMOUNT IN WORDS", 8, muted);
  paragraph(new ToWords({ localeCode: "en-IN" }).convert(Number(invoice.total), { currency: true }), 9);
  cursor -= 18; space(45); rule(cursor); cursor -= 22;
  paragraph("PAYMENTS RECEIVED AGAINST THIS BILL", 8, muted);
  if (!invoice.payments.length) paragraph("No payments recorded.", 9, muted);
  for (const payment of invoice.payments) {
    paragraph(`${payment.paidAt.toISOString().slice(0, 10)} | ${payment.mode.replaceAll("_", " ")} | INR ${payment.amount.toFixed(2)}`, 9, green);
    if (payment.reference) paragraph(`Reference: ${payment.reference}`, 8, muted);
  }
  if (invoice.cancelledAt) paragraph(`CANCELLED: ${invoice.cancelReason}`, 10, red);
  space(130); cursor -= 24; rule(cursor); cursor -= 24;
  paragraph("Please quote the bill number when making a payment.", 8, muted);
  paragraph("This is a computer-generated bill and payment record.", 8, muted);
  cursor -= 42;
  page.drawLine({ start: { x: 340, y: cursor + 14 }, end: { x: 553, y: cursor + 14 }, thickness: 0.6, color: muted });
  text("AUTHORIZED SIGNATORY / CENTER SEAL", 340, cursor, 8);
  document.setTitle(invoice.number); document.setAuthor(institute.name);
  return document.save();
}