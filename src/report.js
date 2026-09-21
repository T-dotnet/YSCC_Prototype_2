export const REPORT_FIELDS = [
  { key: "summary", label: "Summary" },
  { key: "changes", label: "Changes over time" },
  { key: "interpretation", label: "Clinician interpretation" },
  { key: "nextSteps", label: "Next steps" },
];

export function reportChanges(previous, content) {
  return REPORT_FIELDS.flatMap(({ key, label }) => {
    const before = previous?.[key] ?? "";
    const after = content[key] ?? "";
    return before === after ? [] : [{ key, label, before, after }];
  });
}

// Older saves already retain complete versions. Compare those snapshots without
// rewriting history or inventing missing author metadata.
export function reportChangeLog(episode) {
  if (!episode.progressReport) return [];
  const versions = [
    episode.progressReport,
    ...(episode.progressReportHistory ?? []),
  ];
  return versions.map((version, index) => {
    const previous = versions[index + 1];
    return {
      ...version,
      initial: version.revision === 1,
      changes:
        version.changes ??
        (previous || version.revision === 1
          ? reportChanges(previous?.content, version.content)
          : null),
    };
  });
}

// Retain the exact evidence behind each authored version, including undated data.
export function reportSources(episode) {
  return episode.collections
    .filter((c) => c.response === "Submitted")
    .map((c) => ({
      id: c.id,
      label: c.label,
      version: c.version ?? null,
      submittedAt: c.submittedAt ?? null,
      revision: c.revision ?? 0,
      respondent: c.respondent ?? null,
      respondentName: c.respondentName ?? null,
      recorder: c.recorder ?? null,
      recorderName: c.recorderName ?? null,
      channel: c.channel ?? null,
      assistance: c.assistance ?? null,
      answers: [...(c.answers ?? [])],
      review: c.review ?? null,
      needsReview: !!c.needsReview,
      reviewNote: c.reviewNote ?? null,
      reviewDate: c.reviewDate ?? null,
      reviewActor: c.reviewActor ?? null,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export const reportSourceKey = (episode) =>
  JSON.stringify(reportSources(episode));

// Annotations are deliberately separate from the authored report. They are
// append-only context against a care period, not edits to questionnaire data
// or a substitute for a clinical review.
export function progressAnnotationError(episode, role, action) {
  if (role !== "Clinician") return "Only a clinician can add an annotation.";
  if (!episode) return "This care period is unavailable.";
  if (typeof action.text !== "string" || !action.text.trim())
    return "Write an annotation before saving.";
  if (action.text.trim().length > 2000)
    return "An annotation can contain no more than 2,000 characters.";
  return null;
}

export function reportEditError(episode, role, action) {
  if (role !== "Clinician") return "Only a clinician can edit this report.";
  if (!episode) return "This care period is unavailable.";
  if (action.expectedRevision !== (episode.progressReport?.revision ?? 0))
    return "This report has changed. Cancel and reopen the editor to use the latest version.";
  if (action.expectedSources !== reportSourceKey(episode))
    return "Questionnaire evidence has changed. Cancel and reopen the editor to review it before saving.";
  if (
    !REPORT_FIELDS.every(
      ({ key }) =>
        typeof action.content?.[key] === "string" &&
        action.content[key].length <= 20000,
    )
  )
    return "Each report section must contain no more than 20,000 characters.";
  if (!action.content.summary.trim()) return "Add a summary before saving.";
  const content = Object.fromEntries(
    REPORT_FIELDS.map(({ key }) => [key, action.content[key].trim()]),
  );
  if (
    episode.progressReport &&
    reportChanges(episode.progressReport.content, content).length === 0 &&
    JSON.stringify(episode.progressReport.sources) === action.expectedSources
  )
    return "No changes to save.";
  return null;
}
