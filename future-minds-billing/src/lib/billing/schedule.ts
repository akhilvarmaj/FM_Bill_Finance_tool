export function monthlySchedule(enrollmentDate: Date, duration: number, billingDay: number, dueDay: number) {
  const start = new Date(Date.UTC(enrollmentDate.getUTCFullYear(), enrollmentDate.getUTCMonth(), 1));
  return Array.from({ length: Math.min(120, Math.max(0, duration)) }, (_, index) => {
    const month = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1));
    const invoiceDate = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), billingDay));
    if (invoiceDate < enrollmentDate) invoiceDate.setTime(enrollmentDate.getTime());
    const dueDate = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), dueDay));
    if (dueDate < invoiceDate) dueDate.setTime(invoiceDate.getTime());
    return { period: month.toISOString().slice(0, 7), invoiceDate: invoiceDate.toISOString().slice(0, 10), dueDate: dueDate.toISOString().slice(0, 10) };
  });
}