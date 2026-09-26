const tones = {
  coral: ["Critical", "High", "Overdue"],
  amber: ["Medium", "Pending", "Paused", "Sent", "Expired"],
  purple: ["Ready for review", "Review pending", "Draft", "Preparation"],
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
