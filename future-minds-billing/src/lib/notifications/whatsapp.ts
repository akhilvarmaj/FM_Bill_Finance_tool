export interface WhatsAppProvider { compose(phone: string, message: string): string; }
export const clickToChat: WhatsAppProvider = {
  compose(phone, message) {
    let digits = phone.replace(/\D/g, "");
    if (digits.length === 10) digits = `91${digits}`;
    if (!/^[1-9]\d{7,14}$/.test(digits)) throw new Error("A valid WhatsApp number is required.");
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  },
};
export function reminderStage(dueDate: Date, today: Date, offsets = [7, 3, 1, 0]): string | null {
  const days = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
  return days < 0 ? "Overdue" : !offsets.includes(days) ? null : days === 0 ? "Due today" : days === 1 ? "Due tomorrow" : `${days}-day reminder`;
}