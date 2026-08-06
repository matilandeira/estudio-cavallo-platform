export const todayISO = () => new Date().toISOString().slice(0, 10);

export const startOfWeekISO = () => {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
};

export const fmtDate = (d) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

export const fmtTime = (t) => (t ? t.slice(0, 5) : "—");

/* Months elapsed since a given date (approximate, by calendar month) */
export function monthsElapsed(dateStr) {
  if (!dateStr) return 0;
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
}

export function isOverdue(dateStr, status) {
  if (!dateStr || status === "Completed") return false;
  return new Date(dateStr) < new Date(todayISO());
}

/* Overdue, or due within the next 7 days — a superset of isOverdue(), used
   by the "⚡ Urgentes · vence esta semana" quick filter. */
export function isUrgent(dateStr, status) {
  if (!dateStr || status === "Completed") return false;
  const in7Days = new Date(todayISO());
  in7Days.setDate(in7Days.getDate() + 7);
  return new Date(dateStr) <= in7Days;
}
