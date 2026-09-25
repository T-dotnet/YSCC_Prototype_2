// Prototype adapter for an external scheduling feed. Replace this function with
// the scheduling system's availability endpoint when an integration exists.
const DAY = 86400000;
const times = ["09:00", "10:30", "14:00", "16:00"];
const dateAtNoon = (date) => new Date(`${date}T12:00:00Z`);
export const addDays = (date, days) =>
  new Date(dateAtNoon(date).getTime() + days * DAY).toISOString().slice(0, 10);

export function availableExternalSlots(start, end) {
  if (!start || !end || start > end) return [];
  const result = [];
  for (let date = start, count = 0; date <= end && count < 366; date = addDays(date, 1), count++) {
    const weekday = dateAtNoon(date).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    times.forEach((time, index) => {
      if ((dateAtNoon(date).getUTCDate() + index) % 3 === 0) return;
      result.push({
        id: `external-demo-${date}-${time}`,
        source: "External scheduling system · sample feed",
        date,
        time,
        durationMinutes: 60,
        practitionerService: index % 2 ? "Northside Centre clinician" : "YSCC clinician",
        deliveryMode: index === 3 ? "Video" : "In person",
      });
    });
  }
  return result;
}

export function validExternalSlot(slot) {
  return Boolean(slot?.id && slot?.source === "External scheduling system · sample feed" &&
    availableExternalSlots(slot.date, slot.date).some((candidate) =>
      Object.keys(candidate).every((key) => candidate[key] === slot[key])));
}

export function assessmentSlots(dueDate, today) {
  if (!dueDate || dueDate < today) return [];
  const start = [today, addDays(dueDate, -14)].sort().at(-1);
  return availableExternalSlots(start, dueDate)
    .sort((a, b) => b.date.localeCompare(a.date) || a.time.localeCompare(b.time));
}
