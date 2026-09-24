export function daysAgoLabel(date, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || Number.isNaN(now.getTime())) return null;
  const [year, month, day] = date.split("-").map(Number);
  const recordedDay = Date.UTC(year, month - 1, day);
  if (new Date(recordedDay).toISOString().slice(0, 10) !== date) return null;
  const currentDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const elapsedDays = Math.round((currentDay - recordedDay) / 86_400_000);
  if (elapsedDays === 0) return "Today";
  if (elapsedDays === 1) return "1 day ago";
  if (elapsedDays > 1) return `${elapsedDays} days ago`;
  return `In ${Math.abs(elapsedDays)} ${elapsedDays === -1 ? "day" : "days"}`;
}
