// Keep the same meaning across record types: pending, underway, attention,
// missed or overdue, complete, and ended each retain their own tone.
const tones = {
  coral: ["Critical", "High", "Overdue", "Did not attend"],
  amber: ["Medium", "Pending", "Paused", "Sent", "Expired", "Record outcome", "Today", "Due today", "Due soon", "Awaiting Information"],
  purple: ["Ready for review", "Review pending", "Draft", "Preparation", "Profiling", "Planned", "Open", "New", "Not started", "Needs planning", "Scheduled"],
  blue: ["Assessment", "Ongoing review", "In Progress", "In progress"],
  teal: ["Closed", "Discharged", "Cancelled", "Not proceed"],
  green: [
    "Active", "Accepted", "Reviewed", "Recorded", "Submitted", "Fulfilled",
    "Resolved", "Completed", "Attended", "Normal", "Selected",
  ],
};

const toneByStatus = new Map(
  Object.entries(tones).flatMap(([tone, statuses]) =>
    statuses.map((status) => [status, tone]),
  ),
);

export function badgeTone(status) {
  return toneByStatus.get(String(status)) || "neutral";
}
