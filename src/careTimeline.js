import { recordedCareEvents } from "./careEvents.js";
import { responseDate } from "./progress.js";
import { k10Series } from "./k10.js";

const EVENT_DATE = (event) => event?.eventDate || event?.date || null;

export function isRecordedDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

const dated = (items) => items.filter((item) => isRecordedDate(item.date));

const item = ({
  id,
  date,
  end,
  label,
  detail,
  kind = "record",
  sourceId,
  sourceType,
}) => ({
  id,
  date,
  ...(isRecordedDate(end) && end > date ? { end } : {}),
  label,
  detail,
  kind,
  sourceId,
  sourceType,
});

function servicePeriods(episode) {
  return (episode?.servicePeriods ?? [])
    .map((period, index) => {
      const date = period.start || period.date;
      if (!isRecordedDate(date)) return null;
      return item({
        id: period.id || `service-${index}`,
        date,
        end: period.end,
        label: period.label || period.setting || "Care setting",
        detail: period.status || "Recorded care setting or intensity",
        kind:
          isRecordedDate(period.end) && period.end > date
            ? "duration"
            : "service",
        sourceId: period.id,
        sourceType: "service",
      });
    })
    .filter(Boolean);
}

function medicationCourses(episode) {
  return (episode?.medicationCourses ?? [])
    .map((course, index) => {
      if (
        !isRecordedDate(course.start) ||
        !isRecordedDate(course.end) ||
        course.end <= course.start
      )
        return null;
      return item({
        id: course.id || `medication-course-${index}`,
        date: course.start,
        end: course.end,
        label: course.label || "Medication course",
        detail: course.status || "Recorded medication course",
        kind: "medication-duration",
        sourceId: course.id,
        sourceType: "medication-course",
      });
    })
    .filter(Boolean);
}

function goalMilestones(episode) {
  return (episode?.goalMilestones ?? [])
    .map((milestone, index) => {
      const date = milestone.date || milestone.recordedDate;
      if (!isRecordedDate(date)) return null;
      return item({
        id: milestone.id || `goal-${index}`,
        date,
        label: milestone.title || milestone.goal || "Goal milestone",
        detail: milestone.status || "Recorded milestone",
        kind: "milestone",
        sourceId: milestone.id,
        sourceType: "goal",
      });
    })
    .filter(Boolean);
}

export function timelinePosition(date, start, end) {
  if (!isRecordedDate(date) || !isRecordedDate(start) || !isRecordedDate(end))
    return 0;
  const startAt = Date.parse(`${start}T12:00:00Z`);
  const endAt = Date.parse(`${end}T12:00:00Z`);
  const dateAt = Date.parse(`${date}T12:00:00Z`);
  if (endAt <= startAt) return 50;
  return Math.max(
    0,
    Math.min(100, ((dateAt - startAt) / (endAt - startAt)) * 100),
  );
}

export function careTimelineData(episode) {
  const events = recordedCareEvents(episode);
  const responses = dated(
    (episode?.collections ?? [])
      .filter((collection) => collection.response === "Submitted")
      .map((collection) =>
        item({
          id: `response-${collection.id}`,
          date: responseDate(collection),
          label: collection.label || "Questionnaire response",
          detail:
            collection.review === "Reviewed"
              ? "Submitted and reviewed"
              : "Submitted response",
          kind: "response",
          sourceId: collection.id,
          sourceType: "collection",
        }),
      ),
  );
  const reviews = dated(
    (episode?.collections ?? []).flatMap((collection) => {
      const completed =
        collection.response === "Submitted" &&
        collection.review === "Reviewed" &&
        isRecordedDate(collection.reviewDate)
          ? [
              item({
                id: `review-${collection.id}`,
                date: collection.reviewDate,
                label: collection.label || "Clinical review",
                detail: "Clinical review recorded",
                kind: "reviewed",
                sourceId: collection.id,
                sourceType: "collection",
              }),
            ]
          : [];
      const planned =
        collection.response !== "Submitted" &&
        /review/i.test(collection.label || "") &&
        isRecordedDate(collection.due)
          ? [
              item({
                id: `planned-review-${collection.id}`,
                date: collection.due,
                label: collection.label,
                detail: "Planned review due",
                kind: "planned",
                sourceId: collection.id,
                sourceType: "collection",
              }),
            ]
          : [];
      return [...completed, ...planned];
    }),
  );
  const services = servicePeriods(episode);
  const medicationEvents = events
    .filter((event) => event.eventType === "medication")
    .map((event) =>
      item({
        id: `medication-${event.id}`,
        date: EVENT_DATE(event),
        label: event.title,
        detail: "Medication change recorded",
        kind: "medication",
        sourceId: event.id,
        sourceType: "event",
      }),
    );
  const medication = [...medicationCourses(episode), ...medicationEvents];
  const k10 = k10Series(episode).points.map((record) =>
    item({
      id: record.id,
      date: record.date,
      label: `K10 raw total ${record.total} / 50`,
      detail: "Complete ten-item response · fictional demo",
      kind: "score",
      sourceId: record.id,
      sourceType: "k10",
    }),
  );
  const contextual = events
    .filter((event) => event.eventType !== "medication")
    .map((event) =>
      item({
        id: `event-${event.id}`,
        date: EVENT_DATE(event),
        label: event.title,
        detail: "Contextual event recorded",
        kind: "event",
        sourceId: event.id,
        sourceType: "event",
      }),
    );
  const goals = goalMilestones(episode);
  const dateValues = [
    episode?.start,
    episode?.end,
    ...responses.flatMap((entry) => [entry.date, entry.end]),
    ...reviews.flatMap((entry) => [entry.date, entry.end]),
    ...services.flatMap((entry) => [entry.date, entry.end]),
    ...medication.flatMap((entry) => [entry.date, entry.end]),
    ...k10.map((entry) => entry.date),
    ...contextual.flatMap((entry) => [entry.date, entry.end]),
    ...goals.flatMap((entry) => [entry.date, entry.end]),
  ].filter(isRecordedDate);
  const start = dateValues.toSorted()[0] || null;
  const end = dateValues.toSorted().at(-1) || start;

  const riskCategories = [
    ["harm", "Safety-related event"],
    ["housing", "Housing instability"],
    ["medication-adverse", "Medication adverse event"],
    ["inpatient", "Inpatient admission"],
  ];

  return {
    start,
    end,
    lanes: [
      { id: "responses", label: "Assessment responses", entries: responses },
      {
        id: "reviews",
        label: "Planned and completed reviews",
        entries: reviews,
      },
      {
        id: "services",
        label: "Care setting and intensity",
        entries: services,
      },
      { id: "medication", label: "Medication context", entries: medication },
      { id: "k10", label: "K10 · raw total", entries: k10 },
      { id: "events", label: "Significant events", entries: contextual },
    ],
    riskRows: riskCategories.map(([eventType, label]) => ({
      id: eventType,
      label,
      entries: events
        .filter((event) => event.eventType === eventType)
        .map((event) =>
          item({
            id: `risk-${event.id}`,
            date: EVENT_DATE(event),
            label: event.title,
            detail: "Recorded event",
            kind: "risk",
            sourceId: event.id,
            sourceType: "event",
          }),
        ),
    })),
    goals,
  };
}
