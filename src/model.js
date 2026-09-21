import {
  createQualitativeSampleAnswers,
  createLikertSampleAnswers,
  sampleAnswersFor,
} from "./sampleQuestionnaires.js";
import { careChanges, recordFieldChanges } from "./activity.js";
import {
  applyIntakeAction,
  canAssess,
  intakeTasks,
  newIntake,
} from "./intake.js";
import {
  DEMO_INSTRUMENT,
  INSTRUMENTS,
  LEGACY_INSTRUMENT,
  LIKERT_INSTRUMENT,
  getInstrument,
  questionnaireState,
  answerLabel,
} from "./instruments.js";

import {
  REPORT_FIELDS,
  reportChanges,
  progressAnnotationError,
  reportEditError,
  reportSourceKey,
  reportSources,
} from "./report.js";
import { careEventContent, careEventError } from "./careEvents.js";
import {
  clinicalRecordContent,
  clinicalRecordError,
} from "./clinicalRecords.js";
import {
  appointmentContent,
  appointmentError,
  appointmentOutcomeContent,
  appointmentOutcomeError,
} from "./appointments.js";
import { K10_SCORING_METHOD } from "./k10.js";
import { QUALITY_STATUSES, getQualityIssues, validISODate } from "./dataQuality.js";

export const TODAY = "2026-09-15";
export const VERSION = DEMO_INSTRUMENT.version;
export const STORAGE_KEY = "yscc-prototype-v1";
export const CONSENT_LIBRARY = [
  {
    id: "assessment-participation",
    title: "Assessment participation",
    description: "Taking part in YSCC assessment and follow-up check-ins.",
    version: "Consent v1.0",
    scope: "This care episode",
  },
  {
    id: "contact-about-care",
    title: "Contact about care",
    description: "Receiving messages about appointments and care activities.",
    version: "Consent v1.0",
    scope: "This care episode",
  },
  {
    id: "service-improvement",
    title: "Service improvement and research",
    description:
      "Using information for approved service improvement or research.",
    version: "Consent v1.0",
    scope: "Person-level purpose",
  },
];
export const DEMO_STAFF = [
  { id: "jess", name: "Jess Taylor", role: "Clinician" },
  { id: "ananya", name: "Ananya", role: "Data Manager" },
];
export const practitionerServiceOptions = (people = []) => {
  const existingContacts = people.flatMap((person) => [
    ...(person.referrals ?? []).map((referral) => referral.destination),
    ...(person.episodes ?? []).flatMap((episode) => [
      ...(episode.appointments ?? []).map(
        (appointment) => appointment.practitionerService,
      ),
      ...(episode.servicePeriods ?? []).map(
        (period) => period.label || period.setting,
      ),
    ]),
  ]);
  const localCareTeam = [
    ...DEMO_STAFF.filter((staff) => staff.role === "Clinician").map(
      (staff) => `${staff.name} · Northside Centre`,
    ),
    "Northside Centre",
  ];
  return [
    ...new Map(
      [...localCareTeam, ...existingContacts]
        .filter((value) => value?.trim())
        .map((value) => [value.trim().toLocaleLowerCase(), value.trim()]),
    ).values(),
  ].toSorted((a, b) => a.localeCompare(b));
};
export const currentStaff = (state) =>
  DEMO_STAFF.find((staff) => staff.id === (state.staffId ?? "jess"));
export const canEditResponses = (state) =>
  ["Clinician", "Data Manager"].includes(currentStaff(state)?.role);
export const formatTimestamp = (timestamp) =>
  new Date(timestamp).toLocaleString("en-GB", { timeZoneName: "short" });
export const uid = () => globalThis.crypto.randomUUID();
export const formatDate = (date) =>
  new Date(date + "T12:00:00")
    .toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
    .replace("Sept", "Sep");
export const initials = (name) =>
  name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
export const displayName = (name, role) =>
  name && !["Not recorded", "Name not recorded", "Unknown"].includes(name)
    ? `${name} · ${role}`
    : name || "Not recorded";
export const displayPersonName = (person) =>
  displayName(person?.name, "Patient");
export const displayFamilyName = (person) =>
  displayName(person?.family, "Family carer");
export const collectionActorIdentity = (person, collection, actor) => {
  const value = collectionActor(person, collection, actor);
  const role =
    actor === "respondent"
      ? collection.respondent === "Family respondent"
        ? "Family carer"
        : "Patient"
      : collection.channel === "Clinician entry"
        ? "Clinician"
        : collection.recorder === "Family respondent"
          ? "Family carer"
          : "Patient";
  return { name: value, role };
};
export const displayCollectionActor = (person, collection, actor) => {
  const { name, role } = collectionActorIdentity(person, collection, actor);
  return displayName(name, role);
};
export const age = (dob) => {
  if (!dob) return "Unknown";
  const d = new Date(dob);
  return 2026 - d.getFullYear() - (dob.slice(5) > "09-15" ? 1 : 0);
};

const seeds = [
  [
    "Kai Thompson",
    "2009-04-18",
    "They/them",
    "90-day review",
    "2026-09-12",
    "Draft",
    "Expired",
  ],
  [
    "Amelia Chen",
    "2007-02-06",
    "She/her",
    "Initial assessment",
    TODAY,
    "Submitted",
    "Ended",
  ],
  [
    "Noah Williams",
    "2010-07-12",
    "He/him",
    "Initial assessment",
    TODAY,
    "Not started",
    "Not sent",
  ],
  [
    "Zoe Patel",
    "2008-11-23",
    "She/her",
    "90-day review",
    TODAY,
    "Submitted",
    "Ended",
  ],
  [
    "Oliver James",
    "2006-06-08",
    "He/him",
    "Initial assessment",
    "2026-09-14",
    "Not started",
    "Active",
  ],
  [
    "Mia Robinson",
    "2009-01-30",
    "She/her",
    "90-day review",
    TODAY,
    "Not started",
    "Not sent",
  ],
];

function previousZoeEpisode() {
  return {
    id: "EP-1027-history-01",
    number: "01",
    status: "Closed",
    start: "2025-02-10",
    end: "2025-06-16",
    disposition: "Discharged",
    reason: "Planned course of support completed in June 2025.",
    collections: [
      ["baseline", "Initial assessment", "2025-02-10", "2025-02-12"],
      ["discharge", "Discharge check-in", "2025-06-12", "2025-06-16"],
    ].map(([key, label, due, reviewDate]) => ({
      id: `A-3-history-${key}`,
      label,
      due,
      version: VERSION,
      assignment: "Fulfilled",
      response: "Submitted",
      review: "Reviewed",
      assessmentProgress: "Completed",
      reviewNote: "Sample responses reviewed during the 2025 course of care.",
      reviewDate,
      answers: sampleAnswersFor(3, key === "baseline" ? "baseline" : "current"),
      attempts: [],
      link: "Ended",
      respondent: "Person",
      recorder: "Person",
      assistance: "Independent",
      channel: "Clinic tablet",
    })),
    events: [
      {
        id: "E-3-history-closed",
        date: "2025-06-16",
        title: "Care episode closed",
        detail: "Planned course of support completed · discharge recorded",
      },
      {
        id: "E-3-history-started",
        date: "2025-02-10",
        title: "Care episode started",
        detail: "First course of care · initial assessment planned",
      },
    ],
  };
}

// Known fictional histories only. Never infer dates from a user's due-date edits.
const sampleHistories = {
  "A-1-current": ["SMS link", "2026-09-14", "2026-09-15"],
  "A-3-current": ["SMS link", "2026-09-14", "2026-09-15"],
  "A-0-baseline": ["Clinic tablet", "2026-06-15", "2026-06-15"],
  "A-3-baseline": ["Clinic tablet", "2026-06-15", "2026-06-15"],
  "A-5-baseline": ["Clinic tablet", "2026-06-15", "2026-06-15"],
  "A-3-history-baseline": ["Clinic tablet", "2025-02-10", "2025-02-10"],
  "A-3-history-discharge": ["Clinic tablet", "2025-06-12", "2025-06-12"],
};

const longitudinalLikertPoints = [
  {
    key: "starting-point",
    label: "Life and care check-in · Starting point",
    due: "2026-06-16",
    submittedAt: "2026-06-16T10:00:00Z",
    reviewDate: "2026-06-18",
    answers: {
      "routine-worked": "Rarely",
      "meaningful-activity": "Sometimes",
      "felt-connected": "Rarely",
      "support-available": "Rarely",
      "felt-heard": "Disagree",
      "understood-next": "Neither agree nor disagree",
    },
  },
  {
    key: "four-weeks",
    label: "Life and care check-in · 4 weeks",
    due: "2026-07-14",
    submittedAt: "2026-07-14T10:00:00Z",
    reviewDate: "2026-07-16",
    answers: {
      "routine-worked": "Sometimes",
      "meaningful-activity": "Sometimes",
      "felt-connected": "Sometimes",
      "support-available": "Sometimes",
      "felt-heard": "Neither agree nor disagree",
      "understood-next": "Agree",
    },
  },
  {
    key: "eight-weeks",
    label: "Life and care check-in · 8 weeks",
    due: "2026-08-11",
    submittedAt: "2026-08-11T10:00:00Z",
    reviewDate: "2026-08-13",
    answers: {
      "routine-worked": "Sometimes",
      "meaningful-activity": "Often",
      "felt-connected": "Sometimes",
      "support-available": "Often",
      "felt-heard": "Agree",
      "understood-next": "Agree",
    },
  },
  {
    key: "twelve-weeks",
    label: "Life and care check-in · 12 weeks",
    due: "2026-09-08",
    submittedAt: "2026-09-08T10:00:00Z",
    reviewDate: "2026-09-10",
    answers: {
      "routine-worked": "Often",
      "meaningful-activity": "Often",
      "felt-connected": "Often",
      "support-available": "Often",
      "felt-heard": "Agree",
      "understood-next": "Strongly agree",
    },
  },
];

const longitudinalQualitativePoints = [
  {
    key: "starting-point",
    label: "Everyday life check-in · Starting point",
    due: "2026-06-16",
    submittedAt: "2026-06-16T09:30:00Z",
    reviewDate: "2026-06-18",
    answers: {
      participation: "In person",
      pace: "One sitting",
      support: "A little support",
      "support-kind": "Explaining the answer options",
      activities: "Learning or work",
      connection: "Yes",
      who: "A family member",
      next: "How taking part works",
      takeaway: "One clear next step",
    },
  },
  {
    key: "four-weeks",
    label: "Everyday life check-in · 4 weeks",
    due: "2026-07-14",
    submittedAt: "2026-07-14T09:30:00Z",
    reviewDate: "2026-07-16",
    answers: {
      participation: "On my own device",
      device: "Yes",
      pace: "Short sections with breaks",
      support: "I’d like someone alongside me",
      "support-kind": "Reading the questions together",
      activities: "Hobbies and free time",
      connection: "I’m not sure",
      next: "My next steps",
      takeaway: "A summary to look back at",
    },
  },
  {
    key: "eight-weeks",
    label: "Everyday life check-in · 8 weeks",
    due: "2026-08-11",
    submittedAt: "2026-08-11T09:30:00Z",
    reviewDate: "2026-08-13",
    answers: {
      participation: "Together with a staff member",
      pace: "Decide as I go",
      support: "A little support",
      "support-kind": "Explaining the answer options",
      activities: "Managing my routine",
      connection: "Not right now",
      next: "Support available to me",
    },
  },
  {
    key: "twelve-weeks",
    label: "Everyday life check-in · 12 weeks",
    due: "2026-09-08",
    submittedAt: "2026-09-08T09:30:00Z",
    reviewDate: "2026-09-10",
    answers: {
      participation: "On my own device",
      device: "Yes",
      pace: "Short sections with breaks",
      support: "I’m comfortable on my own",
      activities: "Managing my routine",
      connection: "Yes",
      who: "A staff member",
      next: "My next steps",
      takeaway: "A summary to look back at",
    },
  },
];

function longitudinalLikertCollections(person, idPrefix = "A-5-life-care") {
  return longitudinalLikertPoints.map((point) => {
    const id = `${idPrefix}-${point.key}`;
    const attemptId = `${id}-sample-session`;
    return {
      id,
      label: point.label,
      due: point.due,
      version: LIKERT_INSTRUMENT.version,
      assignment: "Fulfilled",
      response: "Submitted",
      review: "Reviewed",
      reviewNote:
        "Fictional longitudinal response reviewed for this workspace.",
      reviewActor: "Jess Taylor",
      reviewDate: point.reviewDate,
      assessmentProgress: "Completed",
      answers: createLikertSampleAnswers(point.answers),
      attempts: [
        {
          id: attemptId,
          date: point.submittedAt.slice(0, 10),
          channel: "Clinic tablet",
          status: "Session started (sample)",
          respondentName: person.name,
        },
      ],
      submittedAt: point.submittedAt,
      submittedAttemptId: attemptId,
      link: "Ended",
      respondent: "Person",
      respondentName: person.name,
      recorder: "Person",
      recorderName: person.name,
      assistance: "Independent",
      channel: "Clinic tablet",
    };
  });
}

function longitudinalQualitativeCollections(
  person,
  idPrefix = "A-6-everyday-life",
) {
  return longitudinalQualitativePoints.map((point) => {
    const id = `${idPrefix}-${point.key}`;
    const attemptId = `${id}-sample-session`;
    return {
      id,
      label: point.label,
      due: point.due,
      version: VERSION,
      assignment: "Fulfilled",
      response: "Submitted",
      review: "Reviewed",
      reviewNote:
        "Sample qualitative response reviewed during the care period.",
      reviewActor: "Jess Taylor",
      reviewDate: point.reviewDate,
      assessmentProgress: "Completed",
      answers: createQualitativeSampleAnswers(point.answers),
      attempts: [
        {
          id: attemptId,
          date: point.submittedAt.slice(0, 10),
          channel: "Clinic tablet",
          status: "Session started (sample)",
          respondentName: person.name,
        },
      ],
      submittedAt: point.submittedAt,
      submittedAttemptId: attemptId,
      link: "Ended",
      respondent: "Person",
      respondentName: person.name,
      recorder: "Person",
      recorderName: person.name,
      assistance: "Independent",
      channel: "Clinic tablet",
    };
  });
}

// These are deterministic fictional visualisation fixtures. The category and
// change fields are deliberately supplied alongside the score; the prototype
// does not calculate a clinical category or significance from a total.
function outcomeMeasureFixtures() {
  const source = {
    baseline: "A-7-life-care-starting-point",
    fourWeeks: "A-7-life-care-four-weeks",
    eightWeeks: "A-7-life-care-eight-weeks",
    twelveWeeks: "A-7-life-care-twelve-weeks",
  };
  const record = (id, date, value, category, context, sourceCollectionId, change, extra = {}) => ({
    id,
    date,
    value,
    status: "Complete",
    category,
    context,
    recordedBy: "Jess Taylor",
    notes: "Fictional outcome-measure fixture for report visualisation review.",
    sourceCollectionId,
    change,
    ...extra,
  });

  return [
    {
      key: "k10-plus",
      scoreRange: [10, 50],
      severityBands: [
        { label: "Low distress", from: 10, to: 19, tone: "low" },
        { label: "Moderate distress", from: 20, to: 29, tone: "moderate" },
        { label: "High distress", from: 30, to: 50, tone: "high" },
      ],
      records: [
        record("OM-7-k10-plus-baseline", "2026-06-16", 32, "High distress", "Admission", source.baseline, { label: "Baseline score" }),
        record("OM-7-k10-plus-review", "2026-08-11", 26, "Moderate distress", "Review", source.eightWeeks, { direction: "improved", label: "Improved", clinicallySignificant: true }),
        record("OM-7-k10-plus-latest", "2026-09-08", 22, "Moderate distress", "Review", source.twelveWeeks, { direction: "improved", label: "Improved", clinicallySignificant: true }),
      ],
    },
    {
      key: "k5",
      scoreRange: [5, 25],
      severityBands: [
        { label: "Low distress", from: 5, to: 9, tone: "low" },
        { label: "Moderate distress", from: 10, to: 14, tone: "moderate" },
        { label: "High distress", from: 15, to: 25, tone: "high" },
      ],
      records: [
        record("OM-7-k5-baseline", "2026-06-16", 11, "Moderate distress", "Admission", source.baseline, { label: "Baseline score" }),
        record("OM-7-k5-review", "2026-08-11", 14, "Moderate distress", "Review", source.eightWeeks, { direction: "deteriorated", label: "Deteriorated" }),
        record("OM-7-k5-latest", "2026-09-08", 18, "High distress", "Review", source.twelveWeeks, { direction: "deteriorated", label: "Deteriorated", clinicallySignificant: true }),
      ],
    },
    {
      key: "sdq",
      scoreRange: [0, 40],
      severityBands: [
        { label: "Low difficulties", from: 0, to: 13, tone: "low" },
        { label: "Moderate difficulties", from: 14, to: 19, tone: "moderate" },
        { label: "High difficulties", from: 20, to: 40, tone: "high" },
      ],
      records: [
        record("OM-7-sdq-baseline", "2026-06-18", 17, "Moderate difficulties", "Admission", source.baseline, { label: "Baseline score" }),
        record("OM-7-sdq-review", "2026-08-13", 14, "Moderate difficulties", "Review", source.eightWeeks, { direction: "improved", label: "Improved" }),
        record("OM-7-sdq-latest", "2026-09-09", 12, "Low difficulties", "Review", source.twelveWeeks, { direction: "improved", label: "Improved" }),
      ],
    },
    {
      key: "sidas",
      scoreRange: [0, 50],
      severityBands: [
        { label: "Lower range", from: 0, to: 9, tone: "low" },
        { label: "Middle range", from: 10, to: 19, tone: "moderate" },
        { label: "Higher range", from: 20, to: 50, tone: "high" },
      ],
      records: [
        record("OM-7-sidas-baseline", "2026-06-20", 8, "Lower range", "Admission", source.baseline, { label: "Baseline score" }),
        record("OM-7-sidas-review", "2026-08-13", 6, "Lower range", "Review", source.eightWeeks, { direction: "improved", label: "Improved" }),
        record("OM-7-sidas-latest", "2026-09-10", 4, "Lower range", "Review", source.twelveWeeks, { direction: "improved", label: "Improved" }),
      ],
    },
    {
      key: "who-5",
      scoreRange: [0, 100],
      severityBands: [
        { label: "Lower wellbeing", from: 0, to: 32, tone: "high" },
        { label: "Moderate wellbeing", from: 33, to: 64, tone: "moderate" },
        { label: "Higher wellbeing", from: 65, to: 100, tone: "low" },
      ],
      records: [
        record("OM-7-who5-baseline", "2026-06-16", 36, "Moderate wellbeing", "Admission", source.baseline, { label: "Baseline score" }),
        record("OM-7-who5-review", "2026-08-11", 48, "Moderate wellbeing", "Review", source.eightWeeks, { direction: "improved", label: "Improved" }),
        record("OM-7-who5-latest", "2026-09-08", 56, "Moderate wellbeing", "Review", source.twelveWeeks, { direction: "improved", label: "Improved", clinicallySignificant: true }),
      ],
    },
    {
      key: "iar-dst",
      records: [
        {
          id: "OM-7-iar-dst-baseline",
          date: "2026-06-17",
          value: null,
          status: "Recorded missing",
          context: "Admission",
          recordedBy: "Jess Taylor",
          notes: "Fictional missing-data fixture. The IAR-DST scoring contract is not configured.",
          sourceCollectionId: source.baseline,
          change: { label: "No score available" },
        },
        {
          id: "OM-7-iar-dst-review",
          date: "2026-08-11",
          value: null,
          status: "Incomplete — follow-up required",
          context: "Review",
          recordedBy: "Jess Taylor",
          notes: "Fictional incomplete assessment. Follow-up is required before a score can be shown.",
          sourceCollectionId: source.eightWeeks,
          change: { label: "Awaiting completion" },
        },
        {
          id: "OM-7-iar-dst-latest",
          date: "2026-09-10",
          value: null,
          status: "Incomplete — follow-up required",
          dueState: "Overdue",
          dueDate: "2026-09-10",
          context: "Review",
          recordedBy: "Jess Taylor",
          notes: "Fictional incomplete assessment. Follow-up is required before a score can be shown.",
          sourceCollectionId: source.twelveWeeks,
          change: { label: "Awaiting completion" },
        },
      ],
    },
  ];
}

function createMockFullReportPerson() {
  const id = "YS-1034";
  const episodeId = "EP-1034-01";
  const person = {
    id,
    name: "Jordan Ellis",
    dob: "2008-02-12",
    pronouns: "They/them",
    owner: "Jess Taylor",
    consent: "Recorded",
    contact: "Suitable",
    family: null,
    fixtureLabel: "Fictional full-report example",
    episodes: [],
    intakes: [
      {
        ...newIntake({
          id: `IN-${episodeId}`,
          owner: "Jess Taylor",
          today: TODAY,
          actor: "Sample fixture",
          timestamp: "2026-06-15T09:00:00Z",
          episodeId,
        }),
        status: "Completed",
        outcome: "Proceed",
        consentRecorded: true,
        consentReference: "Fictional completed-intake consent record",
        identityChecked: true,
        permissionChecked: true,
        supportChecked: true,
        triageChecked: true,
        checkEvidence:
          "Fictional full-report fixture; no real clinical decision.",
        decisionBy: "Jess Taylor",
        decisionAt: "2026-06-15T09:00:00Z",
        assessmentOwner: "Jess Taylor",
      },
    ],
  };
  person.episodes = [
    {
      id: episodeId,
      number: "01",
      status: "Active",
      start: "2026-06-15",
      disposition: "Admitted",
      collections: [
        ...longitudinalLikertCollections(person, "A-7-life-care"),
        ...longitudinalQualitativeCollections(person, "A-7-everyday-life"),
      ],
      servicePeriods: [
        {
          id: "SP-7-community",
          label: "Community care",
          start: "2026-06-15",
          end: "2026-09-15",
          status: "Delivered · fictional demo record",
        },
        {
          id: "SP-7-group",
          label: "Group programme",
          start: "2026-07-06",
          end: "2026-08-28",
          status: "Delivered · fictional demo record",
        },
      ],
      appointments: [
        {
          id: "APT-7-overdue-plan",
          appointmentType: "Care review",
          plannedDate: "2026-09-10",
          plannedTime: "10:00",
          plannedDurationMinutes: 45,
          practitionerService: "Jess Taylor · Northside Centre",
          location: "Northside Centre",
          deliveryMode: "In person",
          attendance: "Planned",
          notes: "Confirm attendance or record the outcome.",
          timestamp: "2026-09-04T09:20:00Z",
          actor: "Sample fixture",
          role: "Clinician",
        },
        {
          id: "APT-7-upcoming-plan",
          appointmentType: "Care review",
          plannedDate: "2026-09-23",
          plannedTime: "15:30",
          plannedDurationMinutes: 60,
          practitionerService: "Northside Centre",
          location: "Northside Centre",
          deliveryMode: "Video",
          attendance: "Planned",
          notes: "Planned review of current support goals.",
          timestamp: "2026-09-12T10:00:00Z",
          actor: "Sample fixture",
          role: "Clinician",
        },
        {
          id: "APT-7-attended",
          appointmentType: "Care review",
          plannedDate: "2026-09-12",
          plannedTime: "14:00",
          plannedDurationMinutes: 60,
          practitionerService: "Jess Taylor · Northside Centre",
          location: "Northside Centre",
          deliveryMode: "Phone",
          attendance: "Attended",
          actualDate: "2026-09-12",
          actualTime: "14:08",
          actualDurationMinutes: 48,
          notes: "Fictional completed contact.",
          outcomeNotes: "Next planned review retained.",
          outcomeRecordedAt: "2026-09-12T15:00:00Z",
          outcomeRecordedBy: "Sample fixture",
          clinicalSummary: {
            sessionObjective: "Review current support goals and agreed follow-up.",
            notePreview: "Fictional contact completed; next review remains planned.",
            riskIndicator: "Low · review recorded",
            outcomeMeasures: ["WHO-5", "IAR-DST"],
            tasks: ["Confirm preferred follow-up method"],
            nextAppointment: "23 Sep 2026 · 15:30 · Telehealth",
          },
          timestamp: "2026-09-08T10:00:00Z",
          actor: "Sample fixture",
          role: "Clinician",
        },
        {
          id: "APT-7-cancelled",
          appointmentType: "Community support contact",
          plannedDate: "2026-09-09",
          plannedTime: "11:30",
          plannedDurationMinutes: 30,
          practitionerService: "Community care",
          deliveryMode: "Outreach or community",
          attendance: "Cancelled",
          outcomeNotes: "Fictional cancellation; follow-up remains planned.",
          outcomeRecordedAt: "2026-09-08T16:00:00Z",
          outcomeRecordedBy: "Sample fixture",
          timestamp: "2026-09-03T09:00:00Z",
          actor: "Sample fixture",
          role: "Clinician",
        },
        {
          id: "APT-7-dna",
          appointmentType: "Group programme contact",
          plannedDate: "2026-09-05",
          plannedTime: "09:15",
          plannedDurationMinutes: 45,
          practitionerService: "Group programme",
          deliveryMode: "Other",
          attendance: "Did not attend",
          outcomeNotes: "Fictional non-attendance recorded; check preferred contact method.",
          outcomeRecordedAt: "2026-09-05T10:30:00Z",
          outcomeRecordedBy: "Sample fixture",
          timestamp: "2026-08-29T11:00:00Z",
          actor: "Sample fixture",
          role: "Clinician",
        },
      ],
      reportOutcomeMeasures: outcomeMeasureFixtures(),
      medicationCourses: [
        {
          id: "MC-7-a",
          label: "Medication course A",
          start: "2026-06-28",
          end: "2026-07-27",
          status: "Start and end recorded · fictional demo record",
          source: "Fictional medication log",
          recordedBy: "Jess Taylor",
        },
        {
          id: "MC-7-b",
          label: "Medication course B",
          start: "2026-08-22",
          end: "2026-09-12",
          status: "Start and end recorded · fictional demo record",
          source: "Fictional medication log",
          recordedBy: "Jess Taylor",
        },
      ],
      k10Responses: [
        ["2026-06-16", [4, 3, 4, 3, 3, 3, 4, 3, 3, 3]],
        ["2026-07-14", [3, 3, 3, 3, 3, 2, 3, 3, 3, 3]],
        ["2026-08-11", [3, 2, 3, 2, 3, 2, 3, 3, 2, 3]],
        ["2026-09-08", [3, 3, 3, 2, 3, 2, 3, 2, 3, 3]],
      ].map(([date, answers]) => ({
        id: `K10-7-${date}`,
        date,
        response: "Submitted",
        scoringMethod: K10_SCORING_METHOD,
        answers,
        respondentName: person.name,
        recorderName: person.name,
        review: "Reviewed · fictional demo record",
        source: "Fictional ten-item K10 response",
      })),
      goalMilestones: [
        {
          id: "GM-7-started",
          date: "2026-06-22",
          title: "Build a workable weekly routine",
          status: "Started · fictional demo record",
        },
        {
          id: "GM-7-reviewed",
          date: "2026-07-20",
          title: "Build a workable weekly routine",
          status: "Reviewed · fictional demo record",
        },
        {
          id: "GM-7-progressed",
          date: "2026-08-24",
          title: "Build a workable weekly routine",
          status: "Progressed · fictional demo record",
        },
      ],
      events: [
        ["start", "2026-06-15", "Care episode started", "care-transition"],
        ["group", "2026-07-06", "Group programme added", "care-transition"],
        ["housing", "2026-07-22", "Temporary accommodation changed", "housing"],
        ["med-review", "2026-08-03", "Medication reviewed", "medication"],
        [
          "med-adverse",
          "2026-08-17",
          "Medication adverse event recorded",
          "medication-adverse",
        ],
        [
          "inpatient",
          "2026-08-30",
          "Inpatient admission recorded",
          "inpatient",
        ],
      ].map(([key, date, title, eventType]) => ({
        id: `E-7-${key}`,
        date,
        eventDate: date,
        timestamp: `${date}T09:00:00Z`,
        title,
        detail: `Fictional demo record of ${title.toLowerCase()}.`,
        actionType: "ADD_CARE_EVENT",
        eventType,
        actor: "Sample fixture",
        role: "Clinician",
      })),
    },
  ];
  return person;
}

function createMockIntakePerson() {
  return {
    id: "YS-1031",
    name: "River Morgan",
    dob: "2010-05-22",
    pronouns: "They/them",
    owner: "Jess Taylor",
    consent: "Not recorded",
    contact: "Not yet assessed",
    family: null,
    episodes: [],
    intakes: [
      {
        ...newIntake({
          id: "IN-YS-1031",
          owner: "Jess Taylor",
          today: TODAY,
          actor: "Sample fixture",
          timestamp: "2026-09-12T09:30:00",
        }),
        status: "In progress",
        receivedAt: "2026-09-12T09:30:00",
        source: "Community referral",
        reason: "Initial support request",
        contactMethod: "Phone",
        contactValue: "Not recorded in demo",
        safeContact: "To be confirmed",
        nextAction: "Confirm identity and contact arrangements",
        reviewDate: TODAY,
      },
    ],
  };
}

function createMockIntakeOutcomePerson() {
  return {
    id: "YS-1032",
    name: "Samira Khan",
    dob: "2009-08-11",
    pronouns: "She/her",
    owner: "Jess Taylor",
    consent: "Not recorded",
    contact: "Suitable",
    family: null,
    episodes: [],
    intakes: [
      {
        ...newIntake({
          id: "IN-YS-1032",
          owner: "Jess Taylor",
          today: TODAY,
          actor: "Sample fixture",
          timestamp: "2026-09-10T10:15:00",
        }),
        status: "Completed",
        outcome: "Proceed",
        receivedAt: "2026-09-10T10:15:00",
        source: "School wellbeing team",
        reason: "Request for an initial assessment",
        contactMethod: "SMS",
        safeContact: "Confirmed",
        identityChecked: true,
        permissionChecked: true,
        supportChecked: true,
        triageChecked: true,
        checkEvidence: "Fictional referral and identity checks reviewed.",
        summary: "Intake checks complete; initial assessment can be planned.",
        decisionBy: "Jess Taylor",
        decisionAt: "2026-09-15T11:00:00",
        assessmentOwner: "Jess Taylor",
        nextAction: "Choose a due date and create the initial assessment plan",
        history: [
          {
            id: "IN-YS-1032-completed",
            timestamp: "2026-09-15T11:00:00",
            actor: "Sample fixture",
            title: "Intake completed · Proceed",
            detail:
              "Fictional demo outcome recorded; assessment planning remains a separate step.",
          },
        ],
      },
    ],
  };
}

function createMockIntakeAssessmentPerson() {
  const episodeId = "EP-YS-1033-01";
  return {
    id: "YS-1033",
    name: "Jordan Lee",
    dob: "2008-12-03",
    pronouns: "He/him",
    owner: "Jess Taylor",
    consent: "Recorded",
    contact: "Suitable",
    family: null,
    intakes: [
      {
        ...newIntake({
          id: "IN-YS-1033",
          owner: "Jess Taylor",
          today: TODAY,
          actor: "Sample fixture",
          timestamp: "2026-09-08T14:00:00",
          episodeId,
        }),
        status: "Completed",
        outcome: "Proceed",
        receivedAt: "2026-09-08T14:00:00",
        source: "Primary care referral",
        reason: "Initial assessment requested",
        contactMethod: "SMS",
        safeContact: "Confirmed",
        identityChecked: true,
        permissionChecked: true,
        supportChecked: true,
        triageChecked: true,
        checkEvidence: "Fictional referral and intake checks reviewed.",
        summary: "Intake complete; initial assessment is scheduled.",
        decisionBy: "Jess Taylor",
        decisionAt: "2026-09-10T09:00:00",
        assessmentOwner: "Jess Taylor",
        history: [
          {
            id: "IN-YS-1033-completed",
            timestamp: "2026-09-10T09:00:00",
            actor: "Sample fixture",
            title: "Intake completed · Proceed",
            detail:
              "Fictional intake outcome recorded before assessment planning.",
          },
        ],
      },
    ],
    episodes: [
      {
        id: episodeId,
        number: "01",
        status: "Active",
        start: "2026-09-10",
        disposition: "Undecided",
        collections: [
          {
            id: "A-YS-1033-initial",
            label: "Initial assessment",
            due: "2026-09-22",
            version: VERSION,
            assignment: "Active",
            response: "Not started",
            review: "Pending",
            link: "Not sent",
            attempts: [],
            answers: [],
            respondent: "Person",
            recorder: "Person",
            assistance: "Independent",
            channel: null,
          },
        ],
        events: [
          {
            id: "E-YS-1033-started",
            date: "2026-09-10",
            title: "Care episode started",
            detail: "Initial assessment · intake outcome was Proceed",
          },
        ],
      },
    ],
  };
}

const LEGACY_PARTICIPANT_ROLE = "Young person";

function updateParticipantRoles(value) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (
      ["respondent", "recorder"].includes(key) &&
      child === LEGACY_PARTICIPANT_ROLE
    )
      value[key] = "Person";
    else updateParticipantRoles(child);
  }
}

export function upgradeSampleData(state) {
  if (state.terminologyRevision !== 1) {
    state = structuredClone(state);
    updateParticipantRoles(state);
    state.terminologyRevision = 1;
  }
  const hasOldQuestionnaire = state.people.some((person) =>
    person.episodes.some((episode) =>
      episode.collections.some(
        (collection) => collection.version === LEGACY_INSTRUMENT.version,
      ),
    ),
  );
  if (hasOldQuestionnaire) return createSeed();
  if (state.sampleRevision < 19 || !state.sampleRevision)
    return prepareQualityState(prepareSeed(structuredClone(state)));
  if (state.intakeRevision !== 3)
    state = prepareIntakes(structuredClone(state));
  state = state.consentRevision === 1
    ? state
    : prepareConsentRequests(structuredClone(state));
  return state.qualityRevision === 1
    ? state
    : prepareQualityState(structuredClone(state));
}

function addFictionalProgressReport(episode, { eventId, timestamp, content }) {
  if (!episode || episode.progressReport) return;
  const sources = reportSources(episode);
  // A saved report is useful only when a comparison can be traced to more than
  // one submitted assessment. Keep shorter fixtures intentionally lightweight.
  if (sources.length < 2) return;
  const changes = reportChanges(null, content).map((change) => ({
    ...change,
    key: `report-${change.key}`,
    label: `Report · ${change.label}`,
  }));
  episode.progressReport = {
    revision: 1,
    content,
    changes: reportChanges(null, content),
    actor: "Jess Taylor",
    actorId: "jess",
    role: "Clinician",
    timestamp,
    sources,
  };
  episode.events ??= [];
  if (!episode.events.some((event) => event.id === eventId)) {
    episode.events.push({
      id: eventId,
      date: timestamp.slice(0, 10),
      timestamp,
      title: "Progress report saved",
      detail:
        "Fictional demo report · Jess Taylor · version 1 · initial report saved from submitted assessment evidence.",
      actionType: "SAVE_PROGRESS_REPORT",
      actor: "Jess Taylor",
      actorId: "jess",
      role: "Clinician",
      changes,
    });
  }
}

function prepareSeed(state) {
  const next = state;
  next.people = next.people.filter((person) => person.id !== "YS-1030");
  for (const fixture of [
    createMockIntakePerson(),
    createMockIntakeOutcomePerson(),
    createMockIntakeAssessmentPerson(),
    createMockFullReportPerson(),
  ]) {
    if (!next.people.some((person) => person.id === fixture.id))
      next.people.push(fixture);
  }
  const jordan = next.people.find((person) => person.id === "YS-1034");
  const jordanEpisode = jordan?.episodes.find((episode) => episode.id === "EP-1034-01");
  const jordanFixture = createMockFullReportPerson();
  const jordanFixtureAppointments = jordanFixture.episodes[0].appointments;
  const jordanFixtureMeasures = jordanFixture.episodes[0].reportOutcomeMeasures;
  if (jordanEpisode) {
    jordanEpisode.appointments ??= [];
    for (const appointment of jordanFixtureAppointments) {
      const existing = jordanEpisode.appointments.find(
        (item) => item.id === appointment.id,
      );
      if (!existing) {
        jordanEpisode.appointments.push(appointment);
      } else {
        for (const [key, value] of Object.entries(appointment)) {
          if (existing[key] == null) existing[key] = value;
        }
      }
    }
    jordanEpisode.reportOutcomeMeasures = structuredClone(jordanFixtureMeasures);
  }
  const zoe = next.people.find((p) => p.id === "YS-1027");
  const current = zoe?.episodes.find((e) => e.id === "EP-1027-01");
  if (current && !zoe.episodes.some((e) => e.id === "EP-1027-history-01")) {
    // Keep existing record IDs stable so saved responses and sessions still resolve.
    current.number = "02";
    zoe.episodes.push(previousZoeEpisode());
  }
  const zoeReview = current?.collections.find(
    (collection) => collection.id === "A-3-current",
  );
  next.audit ??= [];
  if (
    zoeReview &&
    !next.audit.some((entry) => entry.id === "AUD-3-collection-correction")
  ) {
    next.audit.unshift({
      id: "AUD-3-collection-correction",
      type: "collection-field-change",
      timestamp: "2026-09-15T11:08:00Z",
      date: "2026-09-15",
      personId: zoe.id,
      episodeId: current.id,
      collectionId: zoeReview.id,
      title: "90-day review — collection details corrected",
      detail:
        "Fictional demo correction retaining the original and corrected collection details.",
      actorId: "ananya",
      actor: "Ananya",
      role: "Data Manager",
      reason:
        "Corrected transcription from the completed questionnaire record.",
      source: "Completed questionnaire record · fictional demo source",
      changes: [
        {
          key: `${zoeReview.id}-assistance`,
          label: `${zoeReview.label} · Completion support`,
          before: "Supported",
          after: zoeReview.assistance,
        },
        {
          key: `${zoeReview.id}-version`,
          label: `${zoeReview.label} · Questionnaire version`,
          before: "Demo check-in v1.0",
          after: zoeReview.version,
        },
      ],
    });
  }
  const mia = next.people.find((p) => p.id === "YS-1029");
  const miaEpisode = mia?.episodes.find((e) => e.id === "EP-1029-01");
  if (miaEpisode) {
    const additions = [
      ...longitudinalLikertCollections(mia),
      ...longitudinalQualitativeCollections(mia),
    ].filter(
      (sample) => !miaEpisode.collections.some((c) => c.id === sample.id),
    );
    const currentIndex = miaEpisode.collections.findIndex(
      (c) => c.id === "A-5-current",
    );
    miaEpisode.collections.splice(
      currentIndex < 0 ? miaEpisode.collections.length : currentIndex,
      0,
      ...additions,
    );
    miaEpisode.servicePeriods ??= [];
    for (const period of [
      {
        id: "SP-5-community-care",
        label: "Community care",
        start: "2026-06-15",
        end: "2026-09-15",
        status: "Delivered · fictional demo record",
      },
      {
        id: "SP-5-group-programme",
        label: "Group programme",
        start: "2026-07-06",
        end: "2026-08-28",
        status: "Delivered · fictional demo record",
      },
    ]) {
      if (
        !miaEpisode.servicePeriods.some((existing) => existing.id === period.id)
      )
        miaEpisode.servicePeriods.push(period);
    }
    miaEpisode.goalMilestones ??= [];
    for (const milestone of [
      {
        id: "GM-5-routine-started",
        date: "2026-06-22",
        title: "Build a workable weekly routine",
        status: "Started · fictional demo record",
      },
      {
        id: "GM-5-routine-reviewed",
        date: "2026-07-20",
        title: "Build a workable weekly routine",
        status: "Reviewed · fictional demo record",
      },
      {
        id: "GM-5-routine-progressed",
        date: "2026-08-24",
        title: "Build a workable weekly routine",
        status: "Progressed · fictional demo record",
      },
    ]) {
      if (
        !miaEpisode.goalMilestones.some(
          (existing) => existing.id === milestone.id,
        )
      )
        miaEpisode.goalMilestones.push(milestone);
    }
    miaEpisode.events ??= [];
    for (const event of [
      {
        id: "E-5-visual-care-transition",
        date: "2026-07-06",
        eventDate: "2026-07-06",
        timestamp: "2026-07-06T09:00:00Z",
        title: "Group programme added",
        detail: "Fictional demo record of a care coordination change.",
        actionType: "ADD_CARE_EVENT",
        eventType: "care-transition",
        actor: "Sample fixture",
        role: "Clinician",
      },
      {
        id: "E-5-visual-housing",
        date: "2026-07-22",
        eventDate: "2026-07-22",
        timestamp: "2026-07-22T09:00:00Z",
        title: "Temporary accommodation changed",
        detail:
          "Fictional demo record of a housing change relevant to care coordination.",
        actionType: "ADD_CARE_EVENT",
        eventType: "housing",
        actor: "Sample fixture",
        role: "Clinician",
      },
      {
        id: "E-5-visual-medication",
        date: "2026-08-03",
        eventDate: "2026-08-03",
        timestamp: "2026-08-03T09:00:00Z",
        title: "Medication reviewed",
        detail: "Fictional demo record of a medication review.",
        actionType: "ADD_CARE_EVENT",
        eventType: "medication",
        actor: "Sample fixture",
        role: "Clinician",
      },
      {
        id: "E-5-visual-medication-adverse",
        date: "2026-08-17",
        eventDate: "2026-08-17",
        timestamp: "2026-08-17T09:00:00Z",
        title: "Medication adverse event recorded",
        detail: "Fictional demo record of a medication adverse event.",
        actionType: "ADD_CARE_EVENT",
        eventType: "medication-adverse",
        actor: "Sample fixture",
        role: "Clinician",
      },
      {
        id: "E-5-visual-inpatient",
        date: "2026-08-30",
        eventDate: "2026-08-30",
        timestamp: "2026-08-30T09:00:00Z",
        title: "Inpatient admission recorded",
        detail: "Fictional demo record of an inpatient admission.",
        actionType: "ADD_CARE_EVENT",
        eventType: "inpatient",
        actor: "Sample fixture",
        role: "Clinician",
      },
    ]) {
      if (!miaEpisode.events.some((existing) => existing.id === event.id))
        miaEpisode.events.push(event);
    }
    next.audit ??= [];
    if (
      !next.audit.some((entry) => entry.id === "AUD-5-collection-correction")
    ) {
      const collection = miaEpisode.collections.find(
        (item) => item.id === "A-6-everyday-life-four-weeks",
      );
      if (collection)
        next.audit.unshift({
          id: "AUD-5-collection-correction",
          type: "collection-field-change",
          timestamp: "2026-07-14T11:12:00Z",
          date: "2026-07-14",
          personId: mia.id,
          episodeId: miaEpisode.id,
          collectionId: collection.id,
          title:
            "Everyday life check-in · 4 weeks — collection details corrected",
          detail:
            "Fictional demo correction retaining the original and corrected collection details.",
          actorId: "ananya",
          actor: "Ananya",
          role: "Data Manager",
          reason: "Corrected transcription from the clinic completion record.",
          source: "Clinic completion record · fictional demo source",
          changes: [
            {
              key: `${collection.id}-channel`,
              label: `${collection.label} · Delivery channel`,
              before: "SMS link",
              after: collection.channel,
            },
            {
              key: `${collection.id}-assistance`,
              label: `${collection.label} · Completion support`,
              before: "Supported",
              after: collection.assistance,
            },
          ],
        });
    }
  }
  for (const person of next.people) {
    for (const episode of person.episodes) {
      for (const c of episode.collections) {
        const history = sampleHistories[c.id];
        if (
          history &&
          [LEGACY_INSTRUMENT.version, VERSION].includes(c.version) &&
          c.response === "Submitted" &&
          c.channel === history[0] &&
          c.respondent === "Person" &&
          c.recorder === "Person" &&
          c.assistance === "Independent" &&
          !c.submittedAt &&
          !c.attempts.length
        ) {
          const [channel, sentAt, submittedAt] = history;
          c.attempts.push({
            id: `${c.id}-sample-session`,
            date: sentAt,
            channel,
            status:
              channel === "SMS link"
                ? "Sent (sample)"
                : "Session started (sample)",
          });
          c.submittedAt = submittedAt;
          c.submittedAttemptId = c.attempts[0].id;
          c.respondentName ??= person.name;
          c.recorderName ??= person.name;
          if (c.review === "Reviewed") c.reviewActor ??= "Jess Taylor";
        }
        // An untouched, unsent sample request has no collection method yet.
        if (
          c.link === "Not sent" &&
          c.response === "Not started" &&
          !c.attempts.length &&
          c.channel === "SMS link"
        ) {
          c.channel = null;
        }
      }
    }
  }
  const additionalCorrectionFixtures = [
    {
      id: "AUD-0-follow-up-correction",
      personId: "YS-1024",
      episodeId: "EP-1024-01",
      collectionId: "A-0-current",
      timestamp: "2026-09-13T10:24:00Z",
      title: "90-day review — follow-up details corrected",
      reason: "Corrected details from the contact attempt record.",
      source: "Contact attempt record · fictional demo source",
      changes: (collection) => [
        {
          key: `${collection.id}-due`,
          label: `${collection.label} · Due date`,
          before: "2026-09-14",
          after: collection.due,
        },
        {
          key: `${collection.id}-response`,
          label: `${collection.label} · Response status`,
          before: "Not started",
          after: collection.response,
        },
      ],
    },
    {
      id: "AUD-1-initial-assessment-correction",
      personId: "YS-1025",
      episodeId: "EP-1025-01",
      collectionId: "A-1-current",
      timestamp: "2026-09-15T10:42:00Z",
      title: "Initial assessment — collection details corrected",
      reason:
        "Corrected transcription from the completed questionnaire record.",
      source: "Completed questionnaire record · fictional demo source",
      changes: (collection) => [
        {
          key: `${collection.id}-channel`,
          label: `${collection.label} · Delivery channel`,
          before: "Clinic tablet",
          after: collection.channel,
        },
        {
          key: `${collection.id}-submitted-at`,
          label: `${collection.label} · Response date`,
          before: "2026-09-14",
          after: collection.submittedAt,
        },
      ],
    },
  ];
  for (const fixture of additionalCorrectionFixtures) {
    const person = next.people.find((item) => item.id === fixture.personId);
    const episode = person?.episodes.find(
      (item) => item.id === fixture.episodeId,
    );
    const collection = episode?.collections.find(
      (item) => item.id === fixture.collectionId,
    );
    if (!collection || next.audit.some((entry) => entry.id === fixture.id))
      continue;
    next.audit.unshift({
      id: fixture.id,
      type: "collection-field-change",
      timestamp: fixture.timestamp,
      date: fixture.timestamp.slice(0, 10),
      personId: person.id,
      episodeId: episode.id,
      collectionId: collection.id,
      title: fixture.title,
      detail:
        "Fictional demo correction retaining the original and corrected collection details.",
      actorId: "ananya",
      actor: "Ananya",
      role: "Data Manager",
      reason: fixture.reason,
      source: fixture.source,
      changes: fixture.changes(collection),
    });
  }
  addFictionalProgressReport(miaEpisode, {
    eventId: "E-5-progress-report-saved",
    timestamp: "2026-09-12T10:30:00Z",
    content: {
      summary:
        "Fictional demo report. Nine submitted check-ins are retained for this care episode. This sample wording is not a clinical conclusion and must not be used for care decisions.",
      changes:
        "The evidence view retains recorded answer changes across the check-ins. Review those changes alongside delivery, review and care-event history rather than treating one response as a conclusion.",
      interpretation:
        "Fictional clinician note: use the longitudinal record to structure the next conversation with Mia and confirm what remains most important to her.",
      nextSteps:
        "At the next review, discuss the recorded changes with Mia, check whether care events affect priorities, and agree any follow-up.",
    },
  });
  next.sampleRevision = 19;
  return prepareConsentRequests(prepareIntakes(next));
}

function prepareConsentRequests(next) {
  for (const person of next.people) {
    if (Array.isArray(person.consentRequests)) continue;
    const assessment = CONSENT_LIBRARY[0];
    person.consentRequests = [
      {
        id: `CR-${person.id}-assessment`,
        consentId: assessment.id,
        title: assessment.title,
        version: assessment.version,
        scope: assessment.scope,
        status: person.consent === "Withdrawn" ? "Withdrawn" : "Accepted",
        channel: "SMS link",
        sentAt: person.episodes[0]?.start || TODAY,
        decidedAt: person.episodes[0]?.start || TODAY,
        decisionMaker: person.name,
        history: [
          {
            status: "Sent",
            at: person.episodes[0]?.start || TODAY,
            actor: "Sample fixture",
          },
          {
            status: person.consent === "Withdrawn" ? "Withdrawn" : "Accepted",
            at: person.episodes[0]?.start || TODAY,
            actor: person.name,
          },
        ],
      },
    ];
  }
  next.consentRevision = 1;
  return next;
}

function prepareQualityState(next) {
  next.qualityIssueWorkflow ??= {};
  next.issues = (next.issues ?? []).map((issue) => {
    const rules = {
      "DQ-001": {
        ruleKey: "demographic-reference-dob",
        severity: "High",
        type: "Inconsistent demographic information",
        workflow: "Person details",
        blocking: true,
        dueDate: "2026-09-17",
      },
      "DQ-002": {
        ruleKey: "contact-suitability",
        severity: "Medium",
        type: "Inconsistent demographic information",
        workflow: "Person details",
        blocking: false,
        dueDate: "2026-09-18",
      },
    };
    const rule = rules[issue.id] || {};
    const detectedAt = issue.detectedAt || "2026-09-15T09:00:00Z";
    return {
      ...issue,
      ...rule,
      organisation: issue.organisation || "Northside Centre",
      submissionPeriod: issue.submissionPeriod || "Sep 2026",
      description: issue.description || issue.detail,
      remediation:
        issue.remediation ||
        issue.nextStep ||
        "Check a verified source, then record the outcome and next action.",
      detectedAt,
      lastUpdated: issue.lastUpdated || detectedAt,
      history:
        issue.history || [
          {
            id: `H-${issue.id}-detected`,
            timestamp: detectedAt,
            actor: "Quality rule set",
            title: "Issue detected",
            detail: issue.detail,
            status: issue.status || "Open",
          },
        ],
    };
  });
  const kai = next.people.find((person) => person.id === "YS-1024");
  if (kai && !kai.demographicReference)
    kai.demographicReference = {
      dob: "2009-04-19",
      source: "the fictional referral record",
    };
  const oliver = next.people.find((person) => person.id === "YS-1028");
  if (oliver && !oliver.contactReference)
    oliver.contactReference = {
      status: "Not confirmed",
      source: "the fictional referral record",
    };
  next.qualityRevision = 1;
  return next;
}

function prepareIntakes(next) {
  for (const person of next.people) {
    person.referrals ??= [];
    if (person.intakes) {
      for (const intake of person.intakes) {
        // Earlier fictional completed fixtures predate the intake consent gate.
        // Bring those samples forward without changing an unfinished intake.
        if (intake.status === "Completed") intake.consentRecorded = true;
        else intake.consentRecorded ??= false;
        intake.consentReference ??= intake.consentRecorded
          ? "Fictional completed-intake consent record"
          : "";
        if (intake.consentRecorded && person.consent !== "Withdrawn")
          person.consent = "Recorded";
        intake.respondentPreference ??= "Person";
        intake.respondentName ??= "";
      }
      continue;
    }
    const seedIndex = seeds.findIndex(
      (s, index) => person.id === `YS-${1024 + index}` && person.name === s[0],
    );
    if (seedIndex >= 0) {
      // Explicit fictional fixture provenance, not inferred completion for arbitrary saved people.
      person.intakes = person.episodes.map((ep) => ({
        ...newIntake({
          id: `IN-${ep.id}`,
          owner: person.owner,
          today: TODAY,
          actor: "Sample fixture",
          timestamp: ep.start + "T09:00:00",
          episodeId: ep.id,
        }),
        status: "Completed",
        outcome: "Proceed",
        consentRecorded: true,
        consentReference: "Fictional completed-intake consent record",
        respondentPreference: "Person",
        identityChecked: true,
        permissionChecked: true,
        supportChecked: true,
        triageChecked: true,
        checkEvidence:
          "Fictional continuing-care fixture; completed intake supplied for the demo.",
        summary: "Sample intake reviewed before this care period.",
        decisionBy: "Jess Taylor",
        decisionAt: ep.start + "T09:00:00",
        assessmentOwner: person.owner,
        history: [
          {
            id: `IN-${ep.id}-fixture`,
            timestamp: ep.start + "T09:00:00",
            actor: "Sample fixture",
            title: "Completed intake · fictional history",
            detail: "Explicit demo fixture, not a recovered clinical decision.",
          },
        ],
      }));
    } else {
      const intake = newIntake({
        id: `IN-${person.id}-migration`,
        owner: person.owner || "Jess Taylor",
        today: TODAY,
        actor: "Workspace migration",
        timestamp: new Date().toISOString(),
        episodeId:
          person.episodes.find((ep) => ep.status === "Active")?.id || null,
      });
      intake.status = "Awaiting information";
      intake.waitingReason =
        "Earlier registration did not record an intake decision.";
      intake.waitingOn = intake.owner;
      intake.nextAction =
        "Review the intake evidence before further assessment work";
      person.intakes = [intake];
    }
  }
  next.intakeRevision = 3;
  return next;
}

export function createSeed() {
  return prepareQualityState(prepareSeed({
    schema: 1,
    terminologyRevision: 1,
    people: [
      ...seeds.map((s, i) => ({
        id: `YS-${1024 + i}`,
        name: s[0],
        dob: s[1],
        pronouns: s[2],
        owner: "Jess Taylor",
        consent: "Recorded",
        contact: "Suitable",
        ...(i === 0
          ? {
              demographicReference: {
                dob: "2009-04-19",
                source: "the fictional referral record",
              },
            }
          : {}),
        ...(i === 4
          ? {
              contactReference: {
                status: "Not confirmed",
                source: "the fictional referral record",
              },
            }
          : {}),
        consentRequests: [
          {
            id: `CR-${1024 + i}-assessment`,
            consentId: "assessment-participation",
            title: "Assessment participation",
            version: "Consent v1.0",
            scope: "This care episode",
            status: "Accepted",
            channel: "SMS link",
            sentAt: "2026-06-15",
            decidedAt: "2026-06-15",
            decisionMaker: s[0],
            history: [
              { status: "Sent", at: "2026-06-15", actor: "Sample fixture" },
              { status: "Accepted", at: "2026-06-15", actor: s[0] },
            ],
          },
        ],
        family: i === 0 ? "Deb Thompson" : null,
        episodes: [
          {
            id: `EP-${1024 + i}-01`,
            number: "01",
            status: "Active",
            start: s[3] === "90-day review" ? "2026-06-15" : "2026-09-08",
            disposition: i === 0 ? "Admitted" : "Undecided",
            collections: [
              ...(s[3] === "90-day review"
                ? [
                    {
                      id: `A-${i}-baseline`,
                      label: "Initial assessment",
                      due: "2026-06-15",
                      version: VERSION,
                      assignment: "Fulfilled",
                      response: "Submitted",
                      review: "Reviewed",
                      reviewNote: "Sample baseline review recorded.",
                      reviewDate: "2026-06-20",
                      answers: sampleAnswersFor(i, "baseline"),
                      attempts: [],
                      respondent: "Person",
                      recorder: "Person",
                      assistance: "Independent",
                      channel: "Clinic tablet",
                    },
                  ]
                : []),
              {
                id: `A-${i}-current`,
                label: s[3],
                due: s[4],
                version: VERSION,
                assignment: s[5] === "Submitted" ? "Fulfilled" : "Active",
                response: s[5],
                review: "Pending",
                link: s[6],
                attempts: ["Expired", "Active"].includes(s[6])
                  ? [
                      {
                        id: `D-${i}`,
                        date: i === 4 ? "2026-09-09" : "2026-09-05",
                        channel: "SMS link",
                        status:
                          s[6] === "Expired" ? "Link expired" : "Sent (sample)",
                      },
                    ]
                  : [],
                answers: s[5] === "Submitted" ? sampleAnswersFor(i) : [],
                respondent: "Person",
                recorder: "Person",
                assistance: "Independent",
                channel: "SMS link",
              },
            ],
            events: [
              {
                id: `E-${i}`,
                date: s[3] === "90-day review" ? "2026-06-15" : "2026-09-08",
                title: "Care episode started",
                detail: "Initial assessment · baseline collection planned",
              },
            ],
          },
        ],
      })),
      createMockIntakePerson(),
      createMockIntakeOutcomePerson(),
      createMockIntakeAssessmentPerson(),
    ],
    issues: [
      {
        id: "DQ-001",
        personId: "YS-1024",
        title: "Confirm date of birth",
        field: "dob",
        ruleKey: "demographic-reference-dob",
        status: "Open",
        severity: "High",
        type: "Inconsistent demographic information",
        workflow: "Person details",
        dueDate: "2026-09-17",
        blocking: true,
        detail:
          "The referral and person record contain different dates. Check a verified source before making a correction.",
      },
      {
        id: "DQ-002",
        personId: "YS-1028",
        title: "Review contact suitability",
        field: "contact",
        ruleKey: "contact-suitability",
        status: "Open",
        severity: "Medium",
        type: "Inconsistent demographic information",
        workflow: "Person details",
        dueDate: "2026-09-18",
        blocking: false,
        detail:
          "Confirm the current contact arrangement with the care team before further invitations.",
      },
    ],
    qualityIssueWorkflow: {},
    audit: [],
  }));
}

export function collectionStatus(c) {
  if (c.assignment === "Cancelled") return "Cancelled";
  if (c.assignment === "Paused") return "Paused";
  if (c.needsReview) return "Ready for review";
  if (c.response === "Submitted" && noClinicalReviewRequired(c))
    return "Completed";
  if (c.review === "Reviewed") return "Reviewed";
  if (c.response === "Submitted") return "Ready for review";
  if (c.due < TODAY) return "Overdue";
  if (c.due === TODAY) return "Due today";
  return "Scheduled";
}
export const noClinicalReviewRequired = (c) =>
  c?.response === "Submitted" &&
  !c.needsReview &&
  (c.channel === "Clinician entry" ||
    (c.channel === "Clinic tablet" && c.assistance === "Supported"));
export const hasPendingClinicalReview = (c) =>
  c?.response === "Submitted" &&
  !noClinicalReviewRequired(c) &&
  (c.review !== "Reviewed" || !!c.needsReview);
export const clinicalReviewStatus = (c) =>
  c.needsReview
    ? "Re-review required"
    : noClinicalReviewRequired(c)
      ? "Not required"
      : c.response !== "Submitted"
        ? "Awaiting response"
        : c.review || "Pending";

export function collectionActor(person, c, actor) {
  const role = c[actor];
  const name = c[`${actor}Name`] || (role === "Person" ? person?.name : null);
  if (role === "Person" || role === "Family respondent") {
    return name || "Name not recorded";
  }
  return name || role || "Not recorded";
}
export const personEventText = (person, detail = "") =>
  detail
    .split(" · ")
    .map((part) =>
      part === "Person" || part === LEGACY_PARTICIPANT_ROLE
        ? person.name
        : part === "Family respondent"
          ? "Respondent name not recorded"
          : part,
    )
    .join(" · ");
export function nextAction(c) {
  if (c.response === "Submitted")
    return noClinicalReviewRequired(c) ? "View details" : "Review responses";
  if (c.link === "Expired") return "Reissue questionnaire";
  if (c.attempts.length) return "Follow up collection";
  return "Set up collection";
}
export function getTasks(state) {
  return [
    ...intakeTasks(state, TODAY),
    ...state.people.flatMap((p) =>
      p.episodes
        .filter((e) => e.status === "Active" && canAssess(p, e))
        .flatMap((e) =>
          e.collections
            .filter(
              (c) =>
                !["Cancelled", "Paused"].includes(c.assignment) &&
                (c.response !== "Submitted" || hasPendingClinicalReview(c)),
            )
            .map((c) => ({
              person: p,
              episode: e,
              collection: c,
              status: collectionStatus(c),
              action: nextAction(c),
            })),
        ),
    ),
  ];
}
export function reducer(state, action) {
  if (action.type === "RESET") return createSeed();
  if (action.type === "UPGRADE_QUESTIONNAIRE_SAMPLES")
    return upgradeSampleData(state);
  if (
    [
      "ADD_PERSON",
      "SAVE_INTAKE",
      "START_ASSESSMENT",
      "REOPEN_INTAKE",
      "ADD_REFERRAL",
      "REFERRAL_EVENT",
    ].includes(action.type)
  )
    return applyIntakeAction(state, action, {
      staff: currentStaff(state),
      uid,
      today: TODAY,
      version: VERSION,
    });
  const next = structuredClone(state);
  const p = next.people.find((p) => p.id === action.personId);
  const e = p?.episodes.find((e) => e.id === action.episodeId);
  const c = e?.collections.find((c) => c.id === action.collectionId);
  const recordedAt = new Date().toISOString();
  const staff = currentStaff(state);
  const priorPerson = state.people.find((person) => person.id === p?.id);
  const priorEpisode = priorPerson?.episodes.find(
    (episode) => episode.id === e?.id,
  );
  const event = (title, detail, context = {}) => {
    if (!e) return;
    const isRespondent =
      action.type === "SUBMIT" && c.channel !== "Clinician entry";
    e.events.unshift({
      id: uid(),
      date: recordedAt.slice(0, 10),
      timestamp: recordedAt,
      title,
      detail,
      actionType: action.type,
      personId: p.id,
      episodeId: e.id,
      actor: isRespondent
        ? collectionActor(p, c, "recorder")
        : staff?.name || "Not recorded",
      actorId: isRespondent ? null : staff?.id || null,
      role: isRespondent ? c.recorder : staff?.role || null,
      collectionId: c?.id || null,
      changes: careChanges(priorEpisode, e),
      ...context,
    });
  };
  switch (action.type) {
    case "ADD_APPOINTMENT": {
      if (e?.status !== "Active" || appointmentError(e, action, TODAY))
        return state;
      const appointment = {
        id: uid(),
        ...appointmentContent(action),
        timestamp: recordedAt,
        actor: staff?.name || "Not recorded",
        actorId: staff?.id || null,
        role: staff?.role || null,
      };
      e.appointments ??= [];
      e.appointments.unshift(appointment);
      break;
    }
    case "RECORD_APPOINTMENT_OUTCOME": {
      const appointment = e?.appointments?.find(
        (item) => item.id === action.appointmentId,
      );
      if (appointmentOutcomeError(e, appointment, action, TODAY)) return state;
      Object.assign(appointment, appointmentOutcomeContent(action), {
        outcomeRecordedAt: recordedAt,
        outcomeRecordedBy: staff?.name || "Not recorded",
        outcomeRecordedById: staff?.id || null,
      });
      break;
    }
    case "ADD_CARE_EVENT": {
      if (careEventError(e, action, TODAY)) return state;
      const content = careEventContent(action);
      e.events ??= [];
      e.events.unshift({
        id: uid(),
        date: action.eventDate,
        eventDate: action.eventDate,
        timestamp: recordedAt,
        title: content.title,
        detail: content.detail,
        actionType: action.type,
        eventType: action.eventType,
        fields: content.fields,
        personId: p.id,
        episodeId: e.id,
        actor: staff?.name || "Not recorded",
        actorId: staff?.id || null,
        role: staff?.role || null,
      });
      break;
    }
    case "ADD_CLINICAL_RECORD": {
      if (e?.status !== "Active" || clinicalRecordError(e, action, TODAY))
        return state;
      const content = clinicalRecordContent(action);
      const record = {
        id: uid(),
        recordDate: action.recordDate,
        timestamp: recordedAt,
        title: content.title,
        detail: content.detail,
        recordType: action.recordType,
        fields: content.fields,
        personId: p.id,
        episodeId: e.id,
        actor: staff?.name || "Not recorded",
        actorId: staff?.id || null,
        role: staff?.role || null,
      };
      e.clinicalRecords ??= [];
      e.clinicalRecords.unshift(record);
      break;
    }
    case "CORRECT_CARE_EVENT": {
      const correctedEvent = e?.events?.find(
        (item) => item.id === action.correctedEventId,
      );
      if (!correctedEvent || careEventError(e, action, TODAY)) return state;
      const content = careEventContent(action);
      e.events.unshift({
        id: uid(),
        date: action.eventDate,
        eventDate: action.eventDate,
        timestamp: recordedAt,
        title: `Correction: ${content.title}`,
        detail: `Corrects “${correctedEvent.title}”. ${content.detail}`,
        actionType: action.type,
        eventType: action.eventType,
        fields: content.fields,
        correctedEventId: correctedEvent.id,
        correctionReason: action.correctionReason.trim(),
        personId: p.id,
        episodeId: e.id,
        actor: staff?.name || "Not recorded",
        actorId: staff?.id || null,
        role: staff?.role || null,
      });
      break;
    }
    case "SAVE_PROGRESS_REPORT": {
      const staff = currentStaff(state);
      if (reportEditError(e, staff?.role, action)) return state;
      const previous = e.progressReport;
      const timestamp = recordedAt;
      const content = Object.fromEntries(
        REPORT_FIELDS.map(({ key }) => [key, action.content[key].trim()]),
      );
      const changes = reportChanges(previous?.content, content);
      e.progressReportHistory ??= [];
      if (previous) e.progressReportHistory.unshift(previous);
      e.progressReport = {
        revision: (previous?.revision ?? 0) + 1,
        content,
        changes,
        actor: staff.name,
        actorId: staff.id,
        role: staff.role,
        timestamp,
        sources: reportSources(e),
      };
      event(
        "Progress report saved",
        `${staff.name} · version ${e.progressReport.revision} · ${
          !previous
            ? "Initial report saved"
            : changes.length
              ? changes.map(({ label }) => label).join(", ")
              : "Evidence updated; narrative unchanged"
        }`,
      );
      break;
    }
    case "ADD_PROGRESS_ANNOTATION": {
      if (progressAnnotationError(e, staff?.role, action)) return state;
      const annotation = {
        id: uid(),
        text: action.text.trim(),
        actor: staff.name,
        actorId: staff.id,
        role: staff.role,
        timestamp: recordedAt,
        reportRevision: e.progressReport?.revision ?? null,
        evidenceRevision: reportSourceKey(e),
      };
      e.progressAnnotations ??= [];
      e.progressAnnotations.unshift(annotation);
      event(
        "Progress annotation added",
        `${staff.name} added an annotation${annotation.reportRevision ? ` against report version ${annotation.reportRevision}` : " before the first saved report"}.`,
        { annotationId: annotation.id },
      );
      break;
    }
    case "SWITCH_STAFF":
      if (!DEMO_STAFF.some((staff) => staff.id === action.staffId))
        return state;
      next.staffId = action.staffId;
      break;
    case "EDIT_RESPONSE": {
      if (responseEditError(state, action)) return state;
      const staff = currentStaff(state);
      const timestamp = recordedAt;
      const priorAnswers = [...c.answers];
      const instrument = getInstrument(c.version);
      const priorPath = questionnaireState(instrument, priorAnswers);
      const nextPath = questionnaireState(instrument, action.answers);
      const changes = nextPath.answers.flatMap((value, index) =>
        value === priorAnswers[index]
          ? []
          : [
              {
                itemIndex: index,
                question:
                  c.respondent === "Family respondent"
                    ? instrument.questions[index].family ||
                      instrument.questions[index].title
                    : instrument.questions[index].title,
                priorValue: priorAnswers[index] ?? null,
                newValue: value,
                priorDisplay: answerLabel(priorPath.entries[index]),
                newDisplay: answerLabel(nextPath.entries[index]),
              },
            ],
      );
      const priorRevision = c.revision ?? 0;
      c.originalAnswers ??= priorAnswers;
      c.answers = nextPath.answers;
      c.revision = priorRevision + 1;
      c.needsReview = c.review === "Reviewed" || !!c.needsReview;
      next.audit.unshift({
        id: uid(),
        type: "response-edit",
        timestamp,
        date: timestamp.slice(0, 10),
        personId: p.id,
        episodeId: e.id,
        collectionId: c.id,
        title: `${c.label} — responses edited`,
        detail: changes
          .map(
            (change) =>
              `${change.question}: ${change.priorDisplay} → ${change.newDisplay}`,
          )
          .join("; "),
        actorId: staff.id,
        actor: staff.name,
        role: staff.role,
        reason: action.reason.trim(),
        source: action.source?.trim() || null,
        respondent: c.respondent,
        recorder: c.recorder,
        respondentName: c.respondentName,
        recorderName: c.recorderName,
        version: c.version,
        priorRevision,
        revision: c.revision,
        changes,
      });
      event(
        "Responses edited",
        `${c.label} · ${staff.name} · revision ${c.revision}${c.needsReview ? " · re-review required" : ""}`,
        { auditId: next.audit[0].id, revision: c.revision },
      );
      break;
    }
    case "PLAN":
      if (
        !canAssess(p, e) ||
        !e ||
        e.status !== "Active" ||
        !action.label?.trim() ||
        !INSTRUMENTS.some(
          (instrument) => instrument.version === (action.version ?? VERSION),
        ) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(action.due || "") ||
        action.due < TODAY
      )
        return state;
      e.collections.push({
        id: uid(),
        label: action.label.trim(),
        due: action.due,
        version: action.version ?? VERSION,
        assignment: "Planned",
        response: "Not started",
        review: "Pending",
        link: "Not sent",
        attempts: [],
        answers: [],
        respondent: "Person",
        recorder: "Person",
        assistance: "Independent",
      });
      event(
        "Follow-up planned",
        `${action.label} · due ${formatDate(action.due)} · same care episode`,
        { collectionId: e.collections.at(-1).id },
      );
      break;
    case "DELIVER":
      if (
        !canAssess(p, e) ||
        !c ||
        e.status !== "Active" ||
        p.consent !== "Recorded" ||
        p.contact !== "Suitable" ||
        !getInstrument(c.version) ||
        c.response === "Submitted" ||
        ["Paused", "Cancelled"].includes(c.assignment)
      )
        return state;
      if (
        !["SMS link", "Clinic tablet", "Clinician entry"].includes(
          action.channel,
        ) ||
        !getInstrument(c.version).respondents.includes(action.respondent)
      )
        return state;
      if (
        !(
          action.channel === "Clinician entry"
            ? ["Transcribed", "Joint completion"]
            : ["Independent", "Supported"]
        ).includes(action.assistance)
      )
        return state;
      if (action.respondent === "Family respondent" && !p.family) return state;
      if (
        action.channel === "Clinician entry" &&
        currentStaff(state)?.role !== "Clinician"
      )
        return state;
      c.assignment = "Active";
      c.link = "Active";
      c.respondent = action.respondent;
      c.respondentName = action.respondent === "Person" ? p.name : p.family;
      c.channel = action.channel;
      c.assistance = action.assistance;
      c.recorder =
        action.channel === "Clinician entry"
          ? currentStaff(state)?.name || "Staff member"
          : action.respondent;
      c.recorderName =
        action.channel === "Clinician entry" ? c.recorder : c.respondentName;
      c.recorderId =
        action.channel === "Clinician entry" ? currentStaff(state).id : null;
      c.attempts.push({
        id: uid(),
        date: TODAY,
        channel: action.channel,
        respondent: c.respondent,
        respondentName: c.respondentName,
        recorderName: c.recorderName,
        recorderId: c.recorderId,
        assistance: c.assistance,
        status:
          action.channel === "SMS link"
            ? "Prepared (sample; not sent)"
            : "Session started (sample)",
      });
      event(
        action.channel === "SMS link"
          ? "Questionnaire link prepared"
          : "Collection session started",
        `${c.respondentName} · ${action.channel} · simulated`,
        { attemptId: c.attempts.at(-1).id },
      );
      break;
    case "SUBMIT":
      if (
        !canAssess(p, e) ||
        !c ||
        e.status !== "Active" ||
        c.response === "Submitted" ||
        c.assignment !== "Active" ||
        c.link !== "Active"
      )
        return state;
      if (
        (action.attemptId && action.attemptId !== c.attempts.at(-1)?.id) ||
        (action.channel && action.channel !== c.channel) ||
        (c.channel === "Clinician entry" &&
          (currentStaff(state)?.role !== "Clinician" ||
            currentStaff(state)?.id !== c.recorderId ||
            action.attemptId !== c.attempts.at(-1)?.id))
      )
        return state;
      if (
        !Array.isArray(action.answers) ||
        !questionnaireState(getInstrument(c.version), action.answers).complete
      )
        return state;
      c.answers = questionnaireState(
        getInstrument(c.version),
        action.answers,
      ).answers;
      c.response = "Submitted";
      c.assignment = "Fulfilled";
      c.link = "Ended";
      c.submittedAt = TODAY;
      c.submittedTimestamp = recordedAt;
      c.submittedAttemptId = c.attempts.at(-1)?.id;
      const reviewRequired = !noClinicalReviewRequired({
        ...c,
        response: "Submitted",
        needsReview: false,
      });
      c.review = reviewRequired ? "Pending" : "Not required";
      event(
        "Questionnaire response received",
        `${c.label} · ${collectionActor(p, c, "respondent")} · ${reviewRequired ? "clinical review pending" : "clinical review not required"}`,
      );
      break;
    case "REVIEW":
      if (
        currentStaff(state)?.role !== "Clinician" ||
        !c ||
        c.response !== "Submitted" ||
        noClinicalReviewRequired(c) ||
        (c.review === "Reviewed" && !c.needsReview) ||
        !action.note?.trim()
      )
        return state;
      if (c.review === "Reviewed") {
        c.reviewHistory ??= [];
        c.reviewHistory.push({
          note: c.reviewNote,
          date: c.reviewDate,
          actor: c.reviewActor || "Not recorded",
          revision: c.reviewRevision ?? 0,
        });
      }
      c.review = "Reviewed";
      c.needsReview = false;
      c.reviewRevision = c.revision ?? 0;
      c.reviewActor = currentStaff(state).name;
      c.reviewNote = action.note.trim();
      c.reviewDate = TODAY;
      event(
        "Clinical review recorded",
        `${c.label} · ${c.reviewActor} · ${c.version}`,
        { reviewRevision: c.reviewRevision },
      );
      break;
    case "CONSENT_SEND": {
      const item = CONSENT_LIBRARY.find(
        (entry) => entry.id === action.consentId,
      );
      if (
        !p ||
        !item ||
        !e ||
        e.status !== "Active" ||
        !["SMS link", "Clinic tablet"].includes(action.channel) ||
        (action.channel === "SMS link" && p.contact !== "Suitable") ||
        p.consentRequests?.some(
          (request) =>
            request.consentId === item.id &&
            ["Sent", "Accepted"].includes(request.status),
        )
      )
        return state;
      const request = {
        id: uid(),
        consentId: item.id,
        title: item.title,
        version: item.version,
        scope:
          item.scope === "This care episode"
            ? `Care episode ${e.number}`
            : item.scope,
        status: "Sent",
        channel: action.channel,
        sentAt: TODAY,
        sentTimestamp: recordedAt,
        history: [
          {
            status: "Sent",
            at: recordedAt,
            actor: staff?.name || "Staff member",
          },
        ],
      };
      p.consentRequests ??= [];
      p.consentRequests.unshift(request);
      event(
        "Consent request sent",
        `${item.title} · ${item.version} · ${action.channel}`,
        {
          consentRequestId: request.id,
        },
      );
      next.audit.unshift({
        id: uid(),
        date: TODAY,
        timestamp: recordedAt,
        personId: p.id,
        title: "Consent request sent",
        detail: `${item.title} · ${action.channel}`,
        actor: staff?.name || "Staff member",
        actorId: staff?.id,
        role: staff?.role,
        scope: request.scope,
      });
      break;
    }
    case "CONSENT_DECISION": {
      const request = p?.consentRequests?.find(
        (item) => item.id === action.consentRequestId,
      );
      if (
        !p ||
        !request ||
        request.status !== "Sent" ||
        !["Accepted", "Declined"].includes(action.status)
      )
        return state;
      request.status = action.status;
      request.decidedAt = TODAY;
      request.decisionTimestamp = recordedAt;
      request.decisionMaker = p.name;
      request.history.push({
        status: action.status,
        at: recordedAt,
        actor: p.name,
      });
      if (request.consentId === "assessment-participation") {
        p.consent = action.status === "Accepted" ? "Recorded" : "Not recorded";
        if (action.status === "Declined")
          p.episodes.forEach((episode) =>
            episode.collections.forEach((collection) => {
              if (
                collection.response !== "Submitted" &&
                collection.link === "Active"
              )
                collection.link = "Revoked";
            }),
          );
      }
      event(
        `Consent request ${action.status.toLowerCase()}`,
        `${request.title} · decision recorded by ${p.name}`,
        { consentRequestId: request.id },
      );
      next.audit.unshift({
        id: uid(),
        date: TODAY,
        timestamp: recordedAt,
        personId: p.id,
        title: `Consent ${action.status.toLowerCase()}`,
        detail: request.title,
        actor: p.name,
        scope: request.scope,
      });
      break;
    }
    case "CONSENT_WITHDRAW": {
      const request = p?.consentRequests?.find(
        (item) => item.id === action.consentRequestId,
      );
      if (!p || !request || request.status !== "Accepted") return state;
      request.status = "Withdrawn";
      request.withdrawnAt = TODAY;
      request.withdrawnTimestamp = recordedAt;
      request.history.push({
        status: "Withdrawn",
        at: recordedAt,
        actor: p.name,
      });
      if (request.consentId === "assessment-participation") {
        p.consent = "Withdrawn";
        p.episodes.forEach((episode) =>
          episode.collections.forEach((collection) => {
            if (
              collection.response !== "Submitted" &&
              collection.link === "Active"
            )
              collection.link = "Revoked";
          }),
        );
      }
      event("Consent withdrawn", `${request.title} · recorded for ${p.name}`, {
        consentRequestId: request.id,
      });
      next.audit.unshift({
        id: uid(),
        date: TODAY,
        timestamp: recordedAt,
        personId: p.id,
        title: "Consent withdrawn",
        detail: request.title,
        actor: p.name,
        scope: request.scope,
      });
      break;
    }
    case "CONSENT":
      if (
        !p ||
        !["Recorded", "Not recorded", "Withdrawn"].includes(action.consent) ||
        !["Suitable", "Not confirmed", "Unsuitable"].includes(action.contact)
      )
        return state;
      const priorParticipation = { consent: p.consent, contact: p.contact };
      p.consent = action.consent;
      p.contact = action.contact;
      p.participationRecord = {
        source: action.source?.trim() || null,
        reason: action.reason?.trim() || null,
        actor: currentStaff(state)?.name || "Staff member",
        timestamp: recordedAt,
        scope:
          "Assessment participation and contact suitability · sample settings",
      };
      if (p.consent !== "Recorded" || p.contact !== "Suitable")
        p.episodes.forEach((ep) =>
          ep.collections.forEach((col) => {
            if (col.response !== "Submitted" && col.link === "Active")
              col.link = "Revoked";
          }),
        );
      next.audit.unshift({
        id: uid(),
        date: TODAY,
        personId: p.id,
        title: "Sample participation settings updated",
        detail: `Permission: ${p.consent}; contact: ${p.contact}`,
        ...p.participationRecord,
        prior: priorParticipation,
        actorId: staff?.id,
        role: staff?.role,
        changes: [
          ...recordFieldChanges(priorParticipation, p, [
            ["consent", "Assessment participation"],
            ["contact", "Contact suitability"],
          ]),
          ...p.episodes.flatMap((episode) =>
            careChanges(
              priorPerson.episodes.find((prior) => prior.id === episode.id),
              episode,
            ),
          ),
        ],
      });
      break;
    case "EPISODE": {
      const unresolvedReferrals = (p?.referrals ?? []).filter(
        (referral) =>
          referral.episodeId === e?.id &&
          ![
            "Resolved handover",
            "Resolved alternative",
            "Cancelled with plan",
          ].includes(referral.handover),
      );
      if (
        !e ||
        e.status !== "Active" ||
        !["Paused", "Closed"].includes(action.status) ||
        !action.reason?.trim()
      )
        return state;
      if (
        action.status === "Closed" &&
        (![
          "Planned care completed",
          "Transferred or handed over",
          "Care ended early",
          "Other or not yet classified",
        ].includes(action.closureCategory) ||
          !["Not applicable", "Planned", "Confirmed"].includes(
            action.handoverStatus,
          ) ||
          ![
            "Not required or not applicable",
            "Complete",
            "Outstanding",
            "Recorded missing",
          ].includes(action.finalMeasureStatus) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(action.end || "") ||
          !Number.isFinite(new Date(`${action.end}T12:00:00`).getTime()) ||
          new Date(`${action.end}T12:00:00`).toISOString().slice(0, 10) !==
            action.end ||
          action.end < e.start ||
          action.end > TODAY ||
          (["Planned", "Confirmed"].includes(action.handoverStatus) &&
            !action.handoverDestination?.trim()) ||
          (action.handoverStatus === "Confirmed" &&
            (!action.receivingResponsiblePerson?.trim() ||
              !action.handoverConfirmationReference?.trim() ||
              !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(
                action.handoverConfirmedAt || "",
              ) ||
              !Number.isFinite(Date.parse(action.handoverConfirmedAt)) ||
              action.handoverConfirmedAt.slice(0, 10) < e.start ||
              action.handoverConfirmedAt.slice(0, 10) > TODAY)) ||
          (unresolvedReferrals.length > 0 &&
            (action.unresolvedReferralRule !== "Reconciliation task required" ||
              !action.referralReconciliationOwner?.trim() ||
              !action.referralReconciliationAction?.trim() ||
              !/^\d{4}-\d{2}-\d{2}$/.test(
                action.referralReconciliationDue || "",
              ) ||
              !Number.isFinite(Date.parse(action.referralReconciliationDue)) ||
              action.referralReconciliationDue < TODAY)))
      )
        return state;
      e.status = action.status;
      if (action.status === "Closed") {
        e.end = action.end;
        e.closureCategory = action.closureCategory;
        e.handoverStatus = action.handoverStatus;
        e.handoverDestination = action.handoverDestination?.trim() || null;
        e.receivingResponsibility =
          action.handoverStatus === "Confirmed" ? "Confirmed" : "Not confirmed";
        e.receivingResponsiblePerson =
          action.receivingResponsiblePerson?.trim() || null;
        e.handoverConfirmedAt = action.handoverConfirmedAt || null;
        e.handoverConfirmationReference =
          action.handoverConfirmationReference?.trim() || null;
        e.finalMeasureStatus = action.finalMeasureStatus;
        e.referralReconciliation = unresolvedReferrals.length
          ? {
              status: "Required",
              count: unresolvedReferrals.length,
              owner: action.referralReconciliationOwner.trim(),
              due: action.referralReconciliationDue,
              action: action.referralReconciliationAction.trim(),
            }
          : null;
        e.referralReconciliationStatus = unresolvedReferrals.length
          ? "Required"
          : null;
        e.referralReconciliationOwner = unresolvedReferrals.length
          ? action.referralReconciliationOwner.trim()
          : null;
        e.referralReconciliationDue = unresolvedReferrals.length
          ? action.referralReconciliationDue
          : null;
        for (const referral of unresolvedReferrals) {
          referral.owner = action.referralReconciliationOwner.trim();
          referral.nextAction = action.referralReconciliationAction.trim();
          referral.reviewDate = action.referralReconciliationDue;
          referral.closureReconciliation = {
            owner: referral.owner,
            due: referral.reviewDate,
            action: referral.nextAction,
          };
          referral.revision += 1;
          referral.history.unshift({
            id: uid(),
            timestamp: recordedAt,
            actor: staff?.name || "Not recorded",
            title: "Closure reconciliation assigned",
            detail: `Care period closed; referral remains open. ${referral.nextAction}`,
            occurredAt: null,
            system: "YSCC care-period closure",
            externalOwner: referral.externalOwner || "",
            nextAction: referral.nextAction,
            reviewDate: referral.reviewDate,
          });
        }
      }
      e.reason = action.reason;
      e.nextCareStep = action.nextCareStep?.trim() || null;
      e.nextCareOwner = action.nextCareOwner?.trim() || p.owner || null;
      e.collections.forEach((c) => {
        if (c.response !== "Submitted") {
          c.assignment = action.status === "Paused" ? "Paused" : "Cancelled";
          c.link = "Revoked";
        }
      });
      event(
        `Care period ${action.status.toLowerCase()}`,
        `${action.reason} · ${
          action.status === "Closed"
            ? `Closure: ${e.closureCategory}; handover: ${e.handoverStatus}${e.handoverDestination ? ` (${e.handoverDestination})` : ""}${e.receivingResponsiblePerson ? ` · receiving responsibility: ${e.receivingResponsiblePerson}` : ""}; final measures: ${e.finalMeasureStatus}${e.referralReconciliation ? ` · ${e.referralReconciliation.count} unresolved referral${e.referralReconciliation.count === 1 ? "" : "s"} assigned for reconciliation` : ""} · `
            : ""
        }Next care step: ${e.nextCareStep || "Not recorded"} · Owner: ${e.nextCareOwner || "Not assigned"} · outstanding collections ${action.status === "Paused" ? "paused" : "cancelled"}; links revoked`,
      );
      break;
    }
    case "UPDATE_QUALITY_ISSUE": {
      const issue = getQualityIssues(state, TODAY).find(
        (item) => item.id === action.issueId && item.personId === action.personId,
      );
      const problem = qualityWorkflowError(state, action);
      if (!issue || problem) return state;
      const timestamp = recordedAt;
      const prior = {
        status: issue.status,
        owner: issue.owner,
        dueDate: issue.dueDate || null,
      };
      const update = {
        status: action.status,
        owner: action.owner,
        dueDate: action.dueDate || null,
        lastUpdated: timestamp,
      };
      const history = [
        {
          id: uid(),
          timestamp,
          actor: staff?.name || "Staff member",
          actorId: staff?.id || null,
          role: staff?.role || null,
          title: "Issue workflow updated",
          detail: action.comment.trim(),
          ...update,
        },
        ...(issue.history || []),
      ];
      const stored = { ...update, history };
      const manual = next.issues.find((item) => item.id === action.issueId);
      if (manual) Object.assign(manual, stored);
      else {
        next.qualityIssueWorkflow ??= {};
        next.qualityIssueWorkflow[action.issueId] = stored;
      }
      next.audit.unshift({
        id: uid(),
        type: "data-quality-workflow",
        date: timestamp.slice(0, 10),
        timestamp,
        personId: action.personId,
        title: `${issue.title} · workflow updated`,
        detail: action.comment.trim(),
        actor: staff?.name || "Staff member",
        actorId: staff?.id || null,
        role: staff?.role || null,
        changes: [
          ["status", "Issue status"],
          ["owner", "Assigned owner"],
          ["dueDate", "Due date"],
        ].flatMap(([key, label]) =>
          prior[key] === stored[key]
            ? []
            : [{ key: `quality-${action.issueId}-${key}`, label, before: prior[key], after: stored[key] }],
        ),
      });
      break;
    }
    case "RESOLVE_ISSUE":
    case "CORRECT": {
      const resolution =
        action.type === "CORRECT" ? "Corrected value" : action.resolution;
      if (qualityResolutionError(state, { ...action, resolution }))
        return state;
      const issue = next.issues.find((i) => i.id === action.issueId);
      const prior = p[issue.field];
      if (resolution === "Corrected value")
        p[issue.field] = action.value.trim();
      issue.status =
        resolution === "Needs investigation" ? "Open" : "Resolved";
      issue.outcome = resolution;
      issue.reason = action.reason.trim();
      issue.owner = currentStaff(state)?.name || p.owner;
      issue.lastUpdated = recordedAt;
      issue.resolvedAt = resolution === "Needs investigation" ? null : recordedAt;
      issue.resolvedBy =
        resolution === "Needs investigation"
          ? null
          : currentStaff(state)?.name || "Staff member";
      issue.nextStep =
        resolution === "Needs investigation" ? action.nextStep.trim() : null;
      issue.history = [
        {
          id: uid(),
          timestamp: recordedAt,
          actor: currentStaff(state)?.name || "Staff member",
          actorId: staff?.id || null,
          role: staff?.role || null,
          title:
            resolution === "Needs investigation"
              ? "Investigation recorded"
              : "Issue resolved",
          detail: action.reason.trim(),
          status: issue.status,
          owner: issue.owner,
          dueDate: issue.dueDate || null,
          source: action.source.trim(),
          resolution,
        },
        ...(issue.history || []),
      ];
      if (
        resolution === "Corrected value" &&
        issue.field === "contact" &&
        action.value !== "Suitable"
      )
        p.episodes.forEach((ep) =>
          ep.collections.forEach((col) => {
            if (col.response !== "Submitted" && col.link === "Active")
              col.link = "Revoked";
          }),
        );
      next.audit.unshift({
        id: uid(),
        date: TODAY,
        personId: p.id,
        title: `${issue.title} · ${resolution.toLowerCase()}`,
        detail:
          resolution === "Corrected value"
            ? `${prior} → ${action.value}`
            : `${prior} · ${resolution === "Confirmed unchanged" ? "Value confirmed without a change" : `Issue remains open. Next step: ${issue.nextStep}`}`,
        reason: action.reason.trim(),
        source: action.source.trim(),
        priorValue: prior,
        newValue: p[issue.field],
        actor: currentStaff(state)?.name || "Staff member",
        timestamp: recordedAt,
        actorId: staff?.id,
        role: staff?.role,
        changes: [
          ...recordFieldChanges(priorPerson, p, [[issue.field, issue.title]]),
          ...recordFieldChanges(
            state.issues.find((item) => item.id === issue.id),
            issue,
            [
              ["status", "Issue status"],
              ["outcome", "Outcome"],
              ["owner", "Issue owner"],
              ["nextStep", "Next investigation step"],
            ],
          ),
          ...p.episodes.flatMap((episode) =>
            careChanges(
              priorPerson.episodes.find((prior) => prior.id === episode.id),
              episode,
            ),
          ),
        ],
      });
      break;
    }
    default:
      return state;
  }
  return next;
}

export function qualityResolutionError(state, action) {
  const person = state.people.find((p) => p.id === action.personId);
  const issue = state.issues.find(
    (i) => i.id === action.issueId && i.personId === action.personId,
  );
  if (!person || !issue || ["Resolved", "Closed"].includes(issue.status))
    return "This issue is already resolved or closed for this person.";
  if (
    !["Confirmed unchanged", "Corrected value", "Needs investigation"].includes(
      action.resolution,
    )
  )
    return "Choose an outcome.";
  if (!action.source?.trim() || !action.reason?.trim())
    return "Record the source checked and the reason for this outcome.";
  if (action.resolution === "Needs investigation" && !action.nextStep?.trim())
    return "Add the next investigation step.";
  if (action.resolution === "Corrected value") {
    if (!action.value?.trim() || action.value === person[issue.field])
      return "The value is unchanged. Choose Confirm unchanged or enter a different value.";
    if (
      issue.field === "contact" &&
      !["Suitable", "Not confirmed", "Unsuitable"].includes(action.value)
    )
      return "Choose a valid contact status.";
    if (
      issue.field === "dob" &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(action.value) ||
        action.value > TODAY ||
        !Number.isFinite(new Date(action.value).getTime()) ||
        new Date(action.value).toISOString().slice(0, 10) !== action.value)
    )
      return "Enter a valid date of birth on or before the sample date.";
  }
  return null;
}

export function qualityWorkflowError(state, action) {
  const issue = getQualityIssues(state, TODAY).find(
    (item) => item.id === action.issueId && item.personId === action.personId,
  );
  if (!issue) return "This issue is no longer available. Reopen the queue and try again.";
  if (!QUALITY_STATUSES.includes(action.status)) return "Choose a valid issue status.";
  if (!DEMO_STAFF.some((staff) => staff.name === action.owner))
    return "Assign the issue to a responsible user.";
  if (action.dueDate && !validISODate(action.dueDate))
    return "Enter a valid due date or leave it blank.";
  if (!action.comment?.trim())
    return "Add a comment explaining the assignment, status or next step.";
  if (action.status === "Resolved" && issue.status !== "Resolved")
    return "Correct the underlying data before marking an issue resolved.";
  if (
    action.status === "Closed" &&
    !["Resolved", "Closed"].includes(issue.status)
  )
    return "An issue can only be closed after it has been resolved.";
  return null;
}

// Shared by the form and reducer so rejected edits never report a successful save.
export function responseEditError(state, action) {
  const person = state.people.find((p) => p.id === action.personId);
  const episode = person?.episodes.find((e) => e.id === action.episodeId);
  const response = episode?.collections.find(
    (c) => c.id === action.collectionId,
  );
  if (!canEditResponses(state)) return "Your role cannot edit responses.";
  if (!response || response.response !== "Submitted")
    return "Only submitted responses can be edited.";
  const instrument = getInstrument(response.version);
  if (!instrument)
    return "The questionnaire version is unavailable for editing.";
  if (action.expectedRevision !== (response.revision ?? 0))
    return "This response has changed. Reopen the editor to review the latest answers.";
  if (!action.reason?.trim()) return "Enter a reason for this edit.";
  if (
    !Array.isArray(action.answers) ||
    !questionnaireState(instrument, action.answers).complete
  )
    return "Choose a valid answer for every applicable question, including any newly shown follow-ups.";
  if (
    questionnaireState(instrument, action.answers).answers.every(
      (value, index) => value === response.answers?.[index],
    )
  )
    return "Change at least one answer before saving.";
  return null;
}
