export function collectionStatus(dueDate: string, today: string, settled: boolean, cancelled = false) {
  if (cancelled) return { key: "cancelled", label: "Cancelled", tone: "neutral" } as const;
  if (settled) return { key: "paid", label: "Paid", tone: "success" } as const;
  const days = Math.round((new Date(dueDate).getTime() - new Date(today).getTime()) / 86400000);
  if (days < 0) return { key: "overdue", label: "Overdue", tone: "danger" } as const;
  if (days === 0) return { key: "today", label: "Due today", tone: "warning" } as const;
  if (days <= 7) return { key: "week", label: days === 1 ? "Due tomorrow" : `Due in ${days} days`, tone: "info" } as const;
  return { key: "upcoming", label: "Upcoming", tone: "neutral" } as const;
}