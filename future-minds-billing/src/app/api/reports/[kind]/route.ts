import { NextResponse } from "next/server";
import { authResponse, currentUser } from "@/lib/auth/http";
import { AuthError, requirePermission } from "@/lib/auth/service";
import { salesReport } from "@/lib/reports/service";
import { reportCsv } from "@/lib/reports/csv";
export async function GET(request: Request, context: { params: Promise<{ kind: string }> }) {
  return authResponse(async () => {
    const kind = (await context.params).kind;
    if (kind !== "sales" && kind !== "courses" && kind !== "payments" && kind !== "marketing") throw new AuthError("Report not found.", 404);
    requirePermission(await currentUser(), `reports.${kind}`);
    const report = await salesReport(Object.fromEntries(new URL(request.url).searchParams));
    let rows: (string | number)[][];
    if (kind === "courses") rows = [["Course", "Billed students", "Sales INR", "Average INR"], ...report.courses.map(course => [course.name, course.students, course.revenue, course.average])];
    else if (kind === "payments") rows = [["Payment mode", "Transactions", "Amount INR"], ...report.methods.map(method => [method.mode, method.count, method.amount])];
    else if (kind === "marketing") rows = [["Metric", "Value"], ["Marketing spend INR", report.spend.toFixed(2)], ["Spend / sales percent", report.spendPercent]];
    else rows = [["Metric", "Value"], ["Invoiced sales INR", report.sales.toFixed(2)], ["Payments received INR", report.collected.toFixed(2)], ["Outstanding INR", report.outstanding.toFixed(2)], ["Students enrolled", report.students], ["Invoices", report.count], ["Monthly payments INR", report.recurring.toFixed(2)], ["One-time payments INR", report.oneTime.toFixed(2)], ["Target INR", report.target.toFixed(2)], ["Achievement percent", report.achievement], ["Month", "Sales INR"], ...report.monthly.map(month => [month.name, month.amount])];
    return new NextResponse(reportCsv([["From", report.range.from.toISOString().slice(0, 10)], ["To", report.range.to.toISOString().slice(0, 10)], ...rows]), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${kind}-report.csv"` } });
  });
}