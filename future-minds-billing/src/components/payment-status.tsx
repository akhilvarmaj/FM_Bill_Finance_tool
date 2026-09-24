import { CheckCircle2, Clock3, AlertCircle, CalendarDays, MinusCircle } from "lucide-react";
import { collectionStatus } from "@/lib/billing/status";
export function PaymentStatus({ dueDate, today, settled, cancelled = false, partial = false }: { dueDate: string; today: string; settled: boolean; cancelled?: boolean; partial?: boolean }) {
  const status = collectionStatus(dueDate, today, settled, cancelled);
  const Icon = status.key === "paid" ? CheckCircle2 : status.key === "overdue" ? AlertCircle : status.key === "today" ? Clock3 : status.key === "cancelled" ? MinusCircle : CalendarDays;
  return <span className={`payment-status tone-${status.tone}`}><Icon size={14} />{status.label}{partial && !settled && !cancelled ? " / Part paid" : ""}</span>;
}