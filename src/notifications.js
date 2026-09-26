import { TODAY, formatDate, collectionStatus, hasPendingClinicalReview } from "./model.js";
import { getQualityIssues } from "./dataQuality.js";
import { appointmentIsOverdue } from "./appointments.js";

export function getNotifications(state, today = TODAY) {
  if (!state) return [];

  const notifications = [];

  // 1. Data quality error
  const qualityIssues = getQualityIssues(state, today).filter(
    (issue) => !["Resolved", "Closed"].includes(issue.status),
  );

  for (const issue of qualityIssues) {
    notifications.push({
      id: `dq-${issue.id}`,
      category: "data_quality",
      categoryLabel: "Data quality error",
      title: issue.title || issue.type || "Data quality issue",
      detail: `${issue.person ? issue.person.name + " · " : ""}${issue.description || issue.nextStep || "Requires resolution"}`,
      personName: issue.person?.name || null,
      personId: issue.person?.id || null,
      href: issue.person?.id ? `/people/${issue.person.id}?tab=quality` : `/quality`,
      severity: issue.severity || "Medium",
    });
  }

  // 2. Assessment overdue & 4. Assessment ready for review
  for (const person of state.people || []) {
    for (const episode of person.episodes || []) {
      if (episode.status !== "Active") continue;

      for (const c of episode.collections || []) {
        if (["Cancelled", "Paused"].includes(c.assignment)) continue;

        const status = collectionStatus(c);

        if (
          status === "Overdue" ||
          (c.response !== "Submitted" && c.due && c.due < today)
        ) {
          notifications.push({
            id: `ao-${person.id}-${c.id}`,
            category: "assessment_overdue",
            categoryLabel: "Assessment overdue",
            title: `${c.title || c.label || "Assessment"} overdue`,
            detail: `${person.name} · Due ${formatDate(c.due)}`,
            personName: person.name,
            personId: person.id,
            collectionId: c.id,
            href: `/people/${person.id}`,
            due: c.due,
          });
        } else if (
          status === "Ready for review" ||
          (c.response === "Submitted" && hasPendingClinicalReview(c))
        ) {
          notifications.push({
            id: `ar-${person.id}-${c.id}`,
            category: "assessment_review",
            categoryLabel: "Assessment ready for review",
            title: `${c.title || c.label || "Assessment"} ready for review`,
            detail: `${person.name} · Submitted ${c.submittedAt ? formatDate(c.submittedAt) : "recently"}`,
            personName: person.name,
            personId: person.id,
            collectionId: c.id,
            href: `/people/${person.id}/assessment-review/${c.id}`,
            submittedAt: c.submittedAt,
          });
        }
      }

      // 3. Contact input overdue
      for (const apt of episode.appointments || []) {
        if (appointmentIsOverdue(apt, today)) {
          notifications.push({
            id: `aptdue-${person.id}-${apt.id}`,
            category: "appointment_overdue",
            categoryLabel: "Contact input overdue",
            title: "Contact input overdue",
            detail: `${person.name} · Planned ${formatDate(apt.plannedDate)}${apt.plannedTime ? ` ${apt.plannedTime}` : ""} (${apt.practitionerService || "Contact"})`,
            personName: person.name,
            personId: person.id,
            appointmentId: apt.id,
            href: `/people/${person.id}?tab=appointments`,
            plannedDate: apt.plannedDate,
          });
        }
      }
    }
  }

  return notifications;
}
