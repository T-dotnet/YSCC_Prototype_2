import {
  answerLabel,
  getInstrument,
  questionnaireState,
} from "./instruments.js";
import { reportChanges } from "./report.js";
import {
  appointmentChanges,
  appointmentSummary,
  appointmentTitle,
} from "./appointments.js";
import {
  clinicalRecordChanges,
  clinicalRecordDetails,
} from "./clinicalRecords.js";
import { historyDate } from "./historyItem.js";

export function recordFieldChanges(before, after, fields) {
  return fields.flatMap(([key, label]) => {
    const prior = before?.[key] ?? null;
    const value = after?.[key] ?? null;
    return prior === value ? [] : [{ key, label, before: prior, after: value }];
  });
}

export function careChanges(before, after) {
  const changes = recordFieldChanges(before, after, [
    ["status", "Care status"],
    ["end", "Care end date"],
    ["reason", "Care decision reason"],
    ["closureCategory", "Closure category"],
    ["handoverStatus", "Handover status"],
    ["handoverDestination", "Handover destination"],
    ["receivingResponsibility", "Receiving responsibility status"],
    ["receivingResponsiblePerson", "Receiving service responsibility"],
    ["handoverConfirmedAt", "Handover confirmation date"],
    ["handoverConfirmationReference", "Handover confirmation reference"],
    ["referralReconciliationStatus", "Referral reconciliation status"],
    ["referralReconciliationOwner", "Referral reconciliation owner"],
    ["referralReconciliationDue", "Referral reconciliation due date"],
    ["finalMeasureStatus", "Final measure status"],
    ["nextCareStep", "Next care step"],
    ["nextCareOwner", "Next care owner"],
  ]);
  for (const collection of after.collections) {
    const previous = before?.collections.find((c) => c.id === collection.id);
    const fields = recordFieldChanges(previous, collection, [
      ["label", "Collection"],
      ["due", "Due date"],
      ["version", "Questionnaire version"],
      ["assignment", "Collection status"],
      ["response", "Response status"],
      ["link", "Link or session status"],
      ["channel", "Delivery channel"],
      ["respondent", "Respondent role"],
      ["respondentName", "Respondent"],
      ["recorderName", "Recorded by"],
      ["assistance", "Completion support"],
      ["submittedAt", "Response date"],
      ["revision", "Answer revision"],
      ["review", "Clinical review status"],
      ["needsReview", "Re-review required"],
      ["reviewNote", "Clinical review note"],
      ["reviewActor", "Clinical reviewer"],
      ["reviewDate", "Clinical review date"],
    ]);
    const instrument = getInstrument(collection.version);
    if (instrument) {
      const priorPath = questionnaireState(instrument, previous?.answers ?? []);
      const nextPath = questionnaireState(instrument, collection.answers ?? []);
      instrument.questions.forEach((question, index) => {
        if (
          (previous?.answers?.[index] ?? null) ===
          (collection.answers?.[index] ?? null)
        )
          return;
        fields.push({
          key: `answer-${question.id}`,
          label:
            collection.respondent === "Family respondent"
              ? question.family || question.title
              : question.title,
          before: previous ? answerLabel(priorPath.entries[index]) : null,
          after: answerLabel(nextPath.entries[index]),
        });
      });
    }
    changes.push(
      ...fields.map((field) => ({
        ...field,
        key: `${collection.id}-${field.key}`,
        label: `${collection.label} · ${field.label}`,
      })),
    );
  }
  for (const period of after.carePeriods ?? []) {
    const previous = before?.carePeriods?.find((item) => item.id === period.id);
    changes.push(...recordFieldChanges(previous, period, [
      ["programStream", "Program stream"],
      ["careLevel", "Care level"],
      ["deliveringUnit", "Delivering team or pod"],
      ["startDate", "Level effective date"],
      ["endDateExclusive", "Level ended before"],
      ["entryReason", "Level entry reason"],
      ["triggeringReviewId", "Triggering review"],
      ["authorisingPractitioner", "Authorising clinician"],
    ]).map((change) => ({ ...change, key: `${period.id}-${change.key}` })));
  }
  if (after.progressReport && after.progressReport !== before?.progressReport) {
    changes.push(
      ...reportChanges(
        before?.progressReport?.content,
        after.progressReport.content,
      ).map((change) => ({
        ...change,
        key: `report-${change.key}`,
        label: `Report · ${change.label}`,
      })),
    );
  }
  return changes;
}

// Use recorded events, plus retained historical source records where no event
// exists. Due dates describe planned work and are not evidence of a past action.
export function activityEntries(person, episode, audit = []) {
  const events = episode.events ?? [];
  const scopedAudit = audit.filter(
    (entry) =>
      entry.personId === person.id &&
      (!entry.episodeId || entry.episodeId === episode.id),
  );
  const entries = events.filter(
    (event) =>
      !scopedAudit.some(
        (entry) =>
          event.auditId === entry.id ||
          (event.actionType === "EDIT_RESPONSE" &&
            entry.type === "response-edit" &&
            event.collectionId === entry.collectionId &&
            event.revision === entry.revision),
      ),
  );
  for (const collection of episode.collections) {
    for (const attempt of collection.attempts) {
      if (events.some((event) => event.attemptId === attempt.id)) continue;
      entries.push({
        ...attempt,
        collectionId: collection.id,
        title:
          attempt.channel === "SMS link"
            ? "Sample questionnaire link prepared"
            : "Collection session started",
        detail: `${collection.label} · ${attempt.respondentName || collection.respondentName || "Respondent not recorded"} · ${attempt.channel} · ${attempt.status}`,
      });
    }
    if (
      collection.response === "Submitted" &&
      !events.some(
        (event) =>
          event.actionType === "SUBMIT" && event.collectionId === collection.id,
      )
    ) {
      entries.push({
        id: `${collection.id}-submitted`,
        collectionId: collection.id,
        date: collection.submittedAt,
        timestamp: collection.submittedTimestamp,
        title: "Questionnaire response received",
        detail: `${collection.label} · ${collection.version}`,
      });
    }
    if (
      collection.review === "Reviewed" &&
      !events.some(
        (event) =>
          event.actionType === "REVIEW" && event.collectionId === collection.id,
      )
    ) {
      entries.push({
        id: `${collection.id}-review`,
        collectionId: collection.id,
        date: collection.reviewDate,
        title: `${collection.label} reviewed`,
        detail: collection.needsReview
          ? "Earlier answers; re-review required"
          : "Clinical review recorded",
        actor: collection.reviewActor,
      });
    }
    for (const [index, review] of (collection.reviewHistory ?? []).entries()) {
      if (
        events.some(
          (event) =>
            event.actionType === "REVIEW" &&
            event.collectionId === collection.id &&
            event.reviewRevision === review.revision,
        )
      )
        continue;
      entries.push({
        ...review,
        id: `${collection.id}-review-${index}`,
        collectionId: collection.id,
        title: `${collection.label} · earlier review`,
        detail: review.note,
      });
    }
  }
  for (const appointment of episode.appointments ?? []) {
    entries.push({
      ...appointment,
      id: `appointment-${appointment.id}`,
      type: "appointment",
      date: appointment.actualDate || appointment.plannedDate,
      title: appointmentTitle(appointment),
      detail: appointmentSummary(appointment),
      scope: "Appointment or service contact",
      changes: appointmentChanges(appointment),
    });
  }
  for (const record of episode.clinicalRecords ?? []) {
    entries.push({
      ...record,
      id: `clinical-record-${record.id}`,
      type: "clinical-record",
      date: record.recordDate,
      scope: "Structured care record",
      detail: record.detail,
      changes: clinicalRecordChanges(record),
      recordDetails: clinicalRecordDetails(record),
    });
  }
  entries.push(
    ...scopedAudit.map((entry) => ({
      ...entry,
      scope: entry.episodeId ? "Care period" : "Person record",
    })),
  );
  const intakes = (person.intakes ?? []).filter(
    (intake) => intake.episodeId === episode.id,
  );
  entries.push(
    ...intakes.flatMap((intake) =>
      intake.history.map((entry) => ({ ...entry, scope: "Intake" })),
    ),
  );
  entries.push(
    ...(person.referrals ?? [])
      .filter(
        (referral) =>
          referral.episodeId === episode.id ||
          (!referral.episodeId &&
            intakes.some((intake) => intake.id === referral.intakeId)),
      )
      .flatMap((referral) =>
        referral.history.map((entry) => ({
          ...entry,
          scope: `Referral · ${referral.destination}`,
        })),
      ),
  );
  return entries
    .map((entry) => {
      if (!entry.attemptId && !entry.id) return entry;
      const collection = episode.collections.find(
        (item) => item.id === entry.collectionId,
      );
      const attempt = collection?.attempts.find(
        (item) => item.id === entry.attemptId || item.id === entry.id,
      );
      if (!collection || !attempt) return entry;
      return {
        ...entry,
        collectionLabel: collection.label,
        attemptRespondent:
          attempt.respondentName ||
          collection.respondentName ||
          "Respondent not recorded",
        attemptChannel: attempt.channel,
        attemptStatus: attempt.status,
      };
    })
    .sort((a, b) =>
      (b.timestamp || b.date || "").localeCompare(a.timestamp || a.date || ""),
    );
}

export function activityChangeDetails(entry) {
  if (entry.type === "response-edit")
    return entry.changes.map((change) => ({
      key: String(change.itemIndex),
      label: change.question,
      before: change.priorDisplay ?? change.priorValue,
      after: change.newDisplay ?? change.newValue,
    }));
  return entry.changes ?? [];
}

// Compliance logs show only retained field-level deltas. Clinical history uses
// the wider activity stream so clinicians can also see delivery and care events.
export function changeLogEntries(person, episode, audit = []) {
  return activityEntries(person, episode, audit).filter(
    (entry) => activityChangeDetails(entry).length > 0,
  );
}

export function globalChangeLogEntries(state) {
  const seen = new Set();
  return state.people.flatMap((person) => {
    const episodes = person.episodes ?? [];
    const entries = episodes.flatMap((episode) =>
      changeLogEntries(person, episode, state.audit).map((entry) => ({
        ...entry,
        // Show when the change was recorded, rather than a planned contact date.
        date: entry.timestamp || entry.date,
        person,
        episodeId: entry.episodeId || episode.id,
      })),
    );
    // Person-level audit changes can appear in more than one care period.
    const withoutEpisode = (state.audit ?? [])
      .filter((entry) => entry.personId === person.id && !entry.episodeId &&
        activityChangeDetails(entry).length > 0 && !entries.some((item) => item.id === entry.id))
      .map((entry) => ({ ...entry, date: entry.timestamp || entry.date, person, scope: "Person record" }));
    return [...entries, ...withoutEpisode].filter((entry) => {
      const key = `${person.id}:${entry.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }).sort((a, b) =>
    (b.timestamp || b.date || "").localeCompare(a.timestamp || a.date || ""),
  );
}

export function clinicalHistoryEntries(person, episode, audit = []) {
  return activityEntries(person, episode, audit).filter(
    (entry) =>
      !entry.type ||
      entry.type === "appointment" ||
      entry.type === "clinical-record",
  ).sort((a, b) =>
    (historyDate(b) || "").localeCompare(historyDate(a) || "") ||
    (b.timestamp || "").localeCompare(a.timestamp || ""),
  );
}

export function careEventEntries(person, episode, audit = []) {
  const records = clinicalHistoryEntries(person, episode, audit).filter(
    (entry) =>
      entry.type === "appointment" ||
      entry.type === "clinical-record" ||
      (entry.eventDate &&
        ["ADD_CARE_EVENT", "CORRECT_CARE_EVENT"].includes(entry.actionType)),
  );
  const assessments = (episode.collections ?? []).map((collection) => ({
    ...collection,
    id: `assessment-${collection.id}`,
    type: "assessment",
    collectionId: collection.id,
    date: collection.response === "Submitted" && collection.submittedAt
      ? collection.submittedAt
      : collection.due,
    title: collection.label,
  }));
  return [...records, ...assessments].sort((a, b) =>
    (historyDate(b) || "").localeCompare(historyDate(a) || "") ||
    (b.timestamp || "").localeCompare(a.timestamp || ""),
  );
}
