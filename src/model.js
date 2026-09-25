import {
  createQualitativeSampleAnswers,
  createLikertSampleAnswers,
  sampleAnswersFor,
  measureSampleAnswers,
  measureSampleCollectionId,
  measureSampleScore,
} from "./sampleQuestionnaires.js";
import { careChanges, recordFieldChanges } from "./activity.js";
import {
  applyIntakeAction,
  canAssess,
  intakeFor,
  intakeTasks,
  newIntake,
} from "./intake.js";
import {
  DEMO_INSTRUMENT,
  INITIAL_ASSESSMENT_INSTRUMENT,
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
import { validExternalSlot } from "./externalAppointmentSlots.js";
import {
  clinicalRecordContent,
  clinicalRecordError,
} from "./clinicalRecords.js";
import {
  appointmentContent,
  appointmentError,
  appointmentMatchesCollectionDate,
  appointmentOutcomeContent,
  appointmentOutcomeError,
} from "./appointments.js";

import { carePeriodError, currentCarePeriod, nextDate, previousDate } from "./carePeriods.js";
import { K10_SCORING_METHOD } from "./k10.js";
import { MEASURE_INSTRUMENTS, measureInstrument, sampleMeasureTotal } from "./measureQuestionnaires.js";
import { QUALITY_STATUSES, getQualityIssues, validISODate } from "./dataQuality.js";

export const PERSON_TAG_OPTIONS = [
  "Follow-up needed",
  "Care coordination",
  "Referral pending",
  "Contact support",
  "Interpreter needed",
  "Review requested",
];
export const SAMPLE_DATE = "2026-09-15";
const localDate = new Date();
const currentLocalDate = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, "0")}-${String(localDate.getDate()).padStart(2, "0")}`;
const testDate = typeof process !== "undefined" ? process.env.YSCC_TEST_DATE : undefined;
export const TODAY = /^\d{4}-\d{2}-\d{2}$/.test(testDate || "") ? testDate : currentLocalDate;
export const VERSION = DEMO_INSTRUMENT.version;
export const CLOSURE_ASSESSMENT_VERSION = "Episode closure assessment v1.0";
export const CLOSURE_FEEDBACK_VERSION = "Care experience feedback v1.0";
export const canCollectInEpisode = (episode, collection) =>
  episode?.status === "Active" ||
  (episode?.status === "Closed" &&
    ((collection?.closureKind === "assessment" && collection.version === CLOSURE_ASSESSMENT_VERSION) ||
      (collection?.closureKind === "feedback" && collection.version === CLOSURE_FEEDBACK_VERSION)));
const closureDueDate = () =>
  new Date(Date.parse(`${TODAY}T12:00:00Z`) + 7 * 86400000)
    .toISOString().slice(0, 10);
const closureCollections = (person, episode, assignedAt = TODAY) =>
  [
    ["assessment", "Episode closure assessment", CLOSURE_ASSESSMENT_VERSION],
    ["feedback", "Care experience feedback", CLOSURE_FEEDBACK_VERSION],
  ].map(([kind, label, version]) => {
    const ready = person.consent === "Recorded" && person.contact === "Suitable";
    return {
      id: `A-${episode.id}-closure-${kind}`,
      closureKind: kind,
      label,
      version,
      due: closureDueDate(),
      assignment: ready ? "Active" : "Planned",
      response: "Not started",
      review: "Pending",
      link: ready ? "Active" : "Not sent",
      channel: "SMS link",
      respondent: "Person",
      respondentName: person.name,
      recorder: "Person",
      recorderName: person.name,
      assistance: "Independent",
      answers: [],
      attempts: ready ? [{
        id: `D-${episode.id}-closure-${kind}`,
        date: assignedAt,
        channel: "SMS link",
        respondent: "Person",
        respondentName: person.name,
        status: "Prepared (sample; not sent)",
      }] : [],
    };
  });
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
export const practitionerServiceOptions = (peopleOrState = []) => {
  const people = Array.isArray(peopleOrState)
    ? peopleOrState
    : (peopleOrState?.people || []);
  const existingContacts = (people || []).flatMap((person) => [
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
  ].sort((a, b) => a.localeCompare(b));
};
export const currentStaff = (state) =>
  DEMO_STAFF.find((staff) => staff.id === (state.staffId ?? "jess"));
export const canEditResponses = (state) =>
  ["Clinician", "Data Manager"].includes(currentStaff(state)?.role);
export const formatTimestamp = (timestamp) =>
  new Date(timestamp).toLocaleString("en-GB", { timeZoneName: "short" });
export const uid = () => globalThis.crypto.randomUUID();
export const formatDate = (date) =>
  !date ? "Not set" :
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
  return Number(TODAY.slice(0, 4)) - d.getFullYear() - (dob.slice(5) > TODAY.slice(5) ? 1 : 0);
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
    SAMPLE_DATE,
    "Submitted",
    "Ended",
  ],
  [
    "Noah Williams",
    "2010-07-12",
    "He/him",
    "Initial assessment",
    SAMPLE_DATE,
    "Not started",
    "Not sent",
  ],
  [
    "Zoe Patel",
    "2008-11-23",
    "She/her",
    "90-day review",
    SAMPLE_DATE,
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
    SAMPLE_DATE,
    "Not started",
    "Not sent",
  ],
];

const samplePersonTags = {
  "YS-1028": { name: "Oliver James", tags: ["Contact support"] },
  "YS-1031": { name: "River Morgan", tags: ["Contact support"] },
  "YS-1034": { name: "Jordan Ellis", tags: ["Care coordination", "Follow-up needed"] },
};

function withSamplePersonTags(state) {
  const missing = state.people.filter((person) => {
    const fixture = samplePersonTags[person.id];
    return fixture && person.name === fixture.name && person.tags === undefined;
  });
  if (!missing.length) return state;
  const next = structuredClone(state);
  for (const person of next.people) {
    const fixture = samplePersonTags[person.id];
    if (fixture && person.name === fixture.name && person.tags === undefined)
      person.tags = [...fixture.tags];
  }
  return next;
}

const sampleCareLevels = {
  "YS-1024": { name: "Kai Thompson", episodes: { "EP-1024-01": "Mid" } },
  "YS-1025": { name: "Amelia Chen", episodes: { "EP-1025-01": "Low" } },
  "YS-1026": { name: "Noah Williams", episodes: { "EP-1026-01": "Mid" } },
  "YS-1027": { name: "Zoe Patel", episodes: { "EP-1027-01": "Mid", "EP-1027-history-01": "Low" } },
  "YS-1028": { name: "Oliver James", episodes: { "EP-1028-01": "Low" } },
  "YS-1029": { name: "Mia Robinson", episodes: { "EP-1029-01": "High" } },
  "YS-1033": { name: "Jordan Lee", episodes: { "EP-YS-1033-01": "Mid" } },
  "YS-1034": { name: "Jordan Ellis", episodes: { "EP-1034-01": "Mid" } },
};

function withSampleCareLevels(state) {
  const missing = state.people.some((person) => {
    const fixture = sampleCareLevels[person.id];
    return fixture?.name === person.name && person.episodes.some((episode) =>
      fixture.episodes[episode.id] && !episode.carePeriods?.length &&
      (!episode.programStream || episode.programStream === "General"));
  });
  if (!missing) return state;
  const next = structuredClone(state);
  for (const person of next.people) {
    const fixture = sampleCareLevels[person.id];
    if (fixture?.name !== person.name) continue;
    for (const episode of person.episodes) {
      const level = fixture.episodes[episode.id];
      if (!level || episode.carePeriods?.length ||
          (episode.programStream && episode.programStream !== "General")) continue;
      episode.programStream = "General";
      episode.carePeriods = [{
        id: `${episode.id}-sample-starting-level`,
        episodeId: episode.id,
        startDate: episode.start,
        endDateExclusive: episode.end ? nextDate(episode.end) : null,
        programStream: "General",
        careLevel: level,
        deliveringUnit: "Northside Centre",
        entryReason: "Starting level recorded",
        triggeringReviewId: null,
        authorisingPractitionerId: "jess",
        authorisingPractitioner: "Jess Taylor",
        actor: "Sample fixture",
        timestamp: `${episode.start}T09:00:00Z`,
      }];
      episode.events ??= [];
      episode.events.push({
        id: `${episode.id}-sample-starting-level-event`,
        episodeId: episode.id,
        carePeriodId: episode.carePeriods[0].id,
        actionType: "SET_INITIAL_CARE_LEVEL",
        date: episode.start,
        effectiveDate: episode.start,
        timestamp: `${episode.start}T09:00:00Z`,
        title: "Starting care level recorded",
        detail: `${episode.programStream} stream · ${level} level · effective ${episode.start}`,
        actor: "Sample fixture",
        role: "Clinician",
      });
    }
  }
  return next;
}

const withSampleFixtures = (state) =>
  ensureJordanFutureAssessment(
    repairJordanAssessmentAppointments(withSampleCareLevels(withSamplePersonTags(state))),
  );

export function sampleAppointmentsForSeed(seedIndex) {
  switch (seedIndex) {
    case 0: // Kai Thompson
      return [
        {
          id: "APT-0-baseline",
          appointmentType: "Initial assessment",
          plannedDate: "2026-06-15",
          plannedTime: "09:30",
          plannedDurationMinutes: 60,
          practitionerService: "Jess Taylor · Northside Centre",
          location: "Northside Centre",
          deliveryMode: "In person",
          attendance: "Attended",
          actualDate: "2026-06-15",
          actualTime: "09:35",
          actualDurationMinutes: 50,
          notes: "In-person baseline assessment and initial check-in on clinic tablet.",
          outcomeNotes:
            "Completed baseline assessment on clinic tablet; routine goals established.",
          outcomeRecordedAt: "2026-06-15T11:00:00Z",
          outcomeRecordedBy: "Jess Taylor",
          timestamp: "2026-06-10T09:00:00Z",
          actor: "Sample fixture",
          role: "Clinician",
        },
        {
          id: "APT-0-90day-review",
          appointmentType: "Care review",
          plannedDate: "2026-09-12",
          plannedTime: "13:30",
          plannedDurationMinutes: 45,
          practitionerService: "Jess Taylor · Northside Centre",
          location: "Northside Centre",
          deliveryMode: "In person",
          attendance: "Planned",
          notes:
            "90-day progress review — check questionnaire draft status with Kai.",
          timestamp: "2026-09-05T10:00:00Z",
          actor: "Sample fixture",
          role: "Clinician",
        },
      ];
    case 1: // Amelia Chen
      return [
        {
          id: "APT-1-initial-assessment",
          appointmentType: "Initial assessment",
          plannedDate: SAMPLE_DATE,
          plannedTime: "10:00",
          plannedDurationMinutes: 60,
          practitionerService: "Jess Taylor · Northside Centre",
          location: "Northside Centre",
          deliveryMode: "In person",
          attendance: "Planned",
          notes:
            "Initial clinical assessment session — review submitted responses and agree next care step.",
          timestamp: "2026-09-08T09:00:00Z",
          actor: "Sample fixture",
          role: "Clinician",
        },
      ];
    case 2: // Noah Williams
      return [
        {
          id: "APT-2-upcoming",
          appointmentType: "Initial assessment",
          plannedDate: "2026-09-18",
          plannedTime: "11:00",
          plannedDurationMinutes: 45,
          practitionerService: "Northside Centre",
          location: "Northside Centre",
          deliveryMode: "In person",
          attendance: "Planned",
          notes: "Introductory meeting and assessment planning.",
          timestamp: "2026-09-10T14:00:00Z",
          actor: "Sample fixture",
          role: "Clinician",
        },
      ];
    case 3: // Zoe Patel
      return [
        {
          id: "APT-3-baseline",
          appointmentType: "Initial assessment",
          plannedDate: "2026-06-15",
          plannedTime: "11:00",
          plannedDurationMinutes: 60,
          practitionerService: "Jess Taylor · Northside Centre",
          location: "Northside Centre",
          deliveryMode: "In person",
          attendance: "Attended",
          actualDate: "2026-06-15",
          actualTime: "11:05",
          actualDurationMinutes: 55,
          notes: "Baseline assessment appointment — completed on clinic tablet.",
          outcomeNotes:
            "Questionnaire completed independently; care plan initiated.",
          outcomeRecordedAt: "2026-06-15T12:30:00Z",
          outcomeRecordedBy: "Jess Taylor",
          timestamp: "2026-06-10T10:00:00Z",
          actor: "Sample fixture",
          role: "Clinician",
        },
        {
          id: "APT-3-90day-review",
          appointmentType: "Care review",
          plannedDate: SAMPLE_DATE,
          plannedTime: "14:00",
          plannedDurationMinutes: 45,
          practitionerService: "Jess Taylor · Northside Centre",
          location: "Northside Centre",
          deliveryMode: "In person",
          attendance: "Planned",
          notes:
            "90-day progress check-in — review submitted questionnaire responses.",
          timestamp: "2026-09-08T11:00:00Z",
          actor: "Sample fixture",
          role: "Clinician",
        },
      ];
    case 4: // Oliver James
      return [
        {
          id: "APT-4-initial",
          appointmentType: "Initial assessment",
          plannedDate: "2026-09-16",
          plannedTime: "10:30",
          plannedDurationMinutes: 45,
          practitionerService: "Jess Taylor · Northside Centre",
          location: "Northside Centre",
          deliveryMode: "Video",
          attendance: "Planned",
          notes: "Initial assessment follow-up via video telehealth.",
          timestamp: "2026-09-10T09:00:00Z",
          actor: "Sample fixture",
          role: "Clinician",
        },
      ];
    case 5: // Mia Robinson
      return [
        {
          id: "APT-5-baseline",
          appointmentType: "Initial assessment",
          plannedDate: "2026-06-15",
          plannedTime: "09:30",
          plannedDurationMinutes: 60,
          practitionerService: "Jess Taylor · Northside Centre",
          location: "Northside Centre",
          deliveryMode: "In person",
          attendance: "Attended",
          actualDate: "2026-06-15",
          actualTime: "09:30",
          actualDurationMinutes: 60,
          notes: "Starting point assessment session on clinic tablet.",
          outcomeNotes: "Completed baseline questionnaire; supportive goals set.",
          outcomeRecordedAt: "2026-06-15T11:00:00Z",
          outcomeRecordedBy: "Jess Taylor",
          timestamp: "2026-06-10T09:00:00Z",
          actor: "Sample fixture",
          role: "Clinician",
        },
        {
          id: "APT-5-four-weeks",
          appointmentType: "Care review",
          plannedDate: "2026-07-14",
          plannedTime: "09:30",
          plannedDurationMinutes: 45,
          practitionerService: "Jess Taylor · Northside Centre",
          location: "Northside Centre",
          deliveryMode: "In person",
          attendance: "Attended",
          actualDate: "2026-07-14",
          actualTime: "09:35",
          actualDurationMinutes: 45,
          notes: "4-week progress check-in.",
          outcomeNotes:
            "Reviewed 4-week questionnaire responses; positive routine adjustments.",
          outcomeRecordedAt: "2026-07-14T11:00:00Z",
          outcomeRecordedBy: "Jess Taylor",
          timestamp: "2026-07-08T09:00:00Z",
          actor: "Sample fixture",
          role: "Clinician",
        },
        {
          id: "APT-5-eight-weeks",
          appointmentType: "Care review",
          plannedDate: "2026-08-11",
          plannedTime: "09:30",
          plannedDurationMinutes: 45,
          practitionerService: "Jess Taylor · Northside Centre",
          location: "Northside Centre",
          deliveryMode: "In person",
          attendance: "Attended",
          actualDate: "2026-08-11",
          actualTime: "09:30",
          actualDurationMinutes: 40,
          notes: "8-week check-in.",
          outcomeNotes:
            "8-week questionnaire reviewed with Mia; agreed continuation of group programme.",
          outcomeRecordedAt: "2026-08-11T11:00:00Z",
          outcomeRecordedBy: "Jess Taylor",
          timestamp: "2026-08-05T09:00:00Z",
          actor: "Sample fixture",
          role: "Clinician",
        },
        {
          id: "APT-5-twelve-weeks",
          appointmentType: "Care review",
          plannedDate: "2026-09-08",
          plannedTime: "09:30",
          plannedDurationMinutes: 45,
          practitionerService: "Jess Taylor · Northside Centre",
          location: "Northside Centre",
          deliveryMode: "In person",
          attendance: "Attended",
          actualDate: "2026-09-08",
          actualTime: "09:35",
          actualDurationMinutes: 45,
          notes: "12-week review and outcome trajectory review.",
          outcomeNotes:
            "12-week questionnaire responses received; Mia and Jess agreed to review the recorded changes at the next contact.",
          outcomeRecordedAt: "2026-09-08T11:00:00Z",
          outcomeRecordedBy: "Jess Taylor",
          timestamp: "2026-09-02T09:00:00Z",
          actor: "Sample fixture",
          role: "Clinician",
        },
        {
          id: "APT-5-upcoming",
          appointmentType: "Care review",
          plannedDate: "2026-09-22",
          plannedTime: "10:00",
          plannedDurationMinutes: 45,
          practitionerService: "Jess Taylor · Northside Centre",
          location: "Northside Centre",
          deliveryMode: "In person",
          attendance: "Planned",
          notes: "Upcoming fortnightly care review.",
          timestamp: "2026-09-12T09:00:00Z",
          actor: "Sample fixture",
          role: "Clinician",
        },
      ];
    default:
      return [];
  }
}

function sampleContextEventsForSeed(seedIndex) {
  const examples = {
    0: {
      date: "2026-09-03",
      title: "School timetable changed",
      eventType: "other",
      detail: "Kai reported a new afternoon class timetable. The care team will confirm a suitable time for the planned review.",
      fields: { source: "Kai (self-report)", impact: "Check appointment time with Kai before rescheduling." },
    },
    3: {
      date: "2026-08-27",
      title: "Temporary transport arrangement changed",
      eventType: "other",
      detail: "Zoe reported that her usual lift to the centre was unavailable for the next two weeks.",
      fields: { source: "Zoe (self-report)", impact: "Confirm travel arrangements for the planned review." },
    },
  };
  const example = examples[seedIndex];
  if (!example) return [];
  return [{
    id: `E-${seedIndex}-context`,
    date: example.date,
    eventDate: example.date,
    timestamp: `${example.date}T09:00:00Z`,
    title: example.title,
    eventType: example.eventType,
    detail: example.detail,
    fields: example.fields,
    actionType: "ADD_CARE_EVENT",
    actor: "Jess Taylor",
    role: "Clinician",
  }];
}

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
    ].map(([key, label, due, reviewDate]) => {
      const apptId = `APT-3-history-${key}`;
      const attemptId = `A-3-history-${key}-sample-session`;
      return {
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
        attempts: [
          {
            id: attemptId,
            date: due,
            channel: "Clinic tablet",
            appointmentId: apptId,
            status: "Session started (sample)",
            respondentName: "Zoe Patel",
          },
        ],
        submittedAt: due,
        submittedAttemptId: attemptId,
        appointmentId: apptId,
        submittedAppointmentId: apptId,
        link: "Ended",
        respondent: "Person",
        respondentName: "Zoe Patel",
        recorder: "Person",
        recorderName: "Zoe Patel",
        assistance: "Independent",
        channel: "Clinic tablet",
      };
    }),
    appointments: [
      {
        id: "APT-3-history-baseline",
        appointmentType: "Initial assessment",
        plannedDate: "2025-02-10",
        plannedTime: "10:00",
        plannedDurationMinutes: 60,
        practitionerService: "Jess Taylor · Northside Centre",
        location: "Northside Centre",
        deliveryMode: "In person",
        attendance: "Attended",
        actualDate: "2025-02-10",
        actualTime: "10:05",
        actualDurationMinutes: 55,
        notes: "Historical initial assessment completed in person.",
        outcomeNotes:
          "Questionnaire completed independently on clinic tablet.",
        outcomeRecordedAt: "2025-02-10T11:30:00Z",
        outcomeRecordedBy: "Jess Taylor",
        timestamp: "2025-02-05T10:00:00Z",
        actor: "Sample fixture",
        role: "Clinician",
      },
      {
        id: "APT-3-history-discharge",
        appointmentType: "Care review",
        plannedDate: "2025-06-12",
        plannedTime: "14:00",
        plannedDurationMinutes: 45,
        practitionerService: "Jess Taylor · Northside Centre",
        location: "Northside Centre",
        deliveryMode: "In person",
        attendance: "Attended",
        actualDate: "2025-06-12",
        actualTime: "14:00",
        actualDurationMinutes: 45,
        notes: "Historical discharge check-in.",
        outcomeNotes: "Discharge check-in completed on clinic tablet.",
        outcomeRecordedAt: "2025-06-12T15:00:00Z",
        outcomeRecordedBy: "Jess Taylor",
        timestamp: "2025-06-05T10:00:00Z",
        actor: "Sample fixture",
        role: "Clinician",
      },
    ],
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
  "A-0-baseline": ["Clinic tablet", "2026-06-15", "2026-06-15", "APT-0-baseline"],
  "A-3-baseline": ["Clinic tablet", "2026-06-15", "2026-06-15", "APT-3-baseline"],
  "A-5-baseline": ["Clinic tablet", "2026-06-15", "2026-06-15", "APT-5-baseline"],
  "A-3-history-baseline": ["Clinic tablet", "2025-02-10", "2025-02-10", "APT-3-history-baseline"],
  "A-3-history-discharge": ["Clinic tablet", "2025-06-12", "2025-06-12", "APT-3-history-discharge"],
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

const samplePointAppointmentId = (idPrefix, key) => {
  if (idPrefix.startsWith("A-7")) {
    if (key === "starting-point") return "APT-7-baseline";
    if (key === "four-weeks") return "APT-7-four-weeks";
    if (key === "eight-weeks") return "APT-7-eight-weeks";
    if (key === "twelve-weeks") return "APT-7-twelve-weeks";
    return null;
  }
  if (idPrefix.startsWith("A-5") || idPrefix.startsWith("A-6")) {
    if (key === "starting-point") return "APT-5-baseline";
    if (key === "four-weeks") return "APT-5-four-weeks";
    if (key === "eight-weeks") return "APT-5-eight-weeks";
    if (key === "twelve-weeks") return "APT-5-twelve-weeks";
  }
  return null;
};

function longitudinalLikertCollections(person, idPrefix = "A-5-life-care") {
  return longitudinalLikertPoints.map((point) => {
    const id = `${idPrefix}-${point.key}`;
    const attemptId = `${id}-sample-session`;
    const apptId = samplePointAppointmentId(idPrefix, point.key);
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
          appointmentId: apptId,
          status: "Session started (sample)",
          respondentName: person.name,
        },
      ],
      submittedAt: point.submittedAt,
      submittedAttemptId: attemptId,
      appointmentId: apptId,
      submittedAppointmentId: apptId,
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
    // These two check-ins were completed independently, even though there
    // were care contacts in the same period. A date match is not a link.
    const independent = ["four-weeks", "twelve-weeks"].includes(point.key);
    const apptId = independent ? null : samplePointAppointmentId(idPrefix, point.key);
    const channel = independent ? "SMS link" : "Clinic tablet";
    return {
      id,
      label: point.label,
      due: point.due,
      version: VERSION,
      assignment: "Fulfilled",
      response: "Submitted",
      review: "Reviewed",
      reviewNote:
        "Sample qualitative response reviewed during the care episode.",
      reviewActor: "Jess Taylor",
      reviewDate: point.reviewDate,
      assessmentProgress: "Completed",
      answers: createQualitativeSampleAnswers(point.answers),
      attempts: [
        {
          id: attemptId,
          date: point.submittedAt.slice(0, 10),
          channel,
          ...(apptId ? { appointmentId: apptId } : {}),
          status: independent ? "Sample link opened" : "Session started (sample)",
          respondentName: person.name,
        },
      ],
      submittedAt: point.submittedAt,
      submittedAttemptId: attemptId,
      appointmentId: apptId,
      submittedAppointmentId: apptId,
      link: "Ended",
      respondent: "Person",
      respondentName: person.name,
      recorder: "Person",
      recorderName: person.name,
      assistance: "Independent",
      channel,
    };
  });
}

function reportMeasureCollections(person) {
  const dates = {
    "k10-plus": ["2026-06-16", "2026-08-11", "2026-09-08"],
    k5: ["2026-06-16", "2026-08-11", "2026-09-08"],
    sdq: ["2026-06-18", "2026-08-13", "2026-09-09"],
    sidas: ["2026-06-20", "2026-08-13", "2026-09-10"],
    "who-5": ["2026-06-16", "2026-08-11", "2026-09-08"],
  };
  const phases = ["baseline", "review", "latest"];
  return MEASURE_INSTRUMENTS.flatMap((instrument) =>
    phases.map((phase, index) => {
      const id = measureSampleCollectionId(instrument.measureKey, phase);
      const date = dates[instrument.measureKey][index];
      const attemptId = `${id}-sample-session`;
      return {
        id,
        label: `${instrument.name} · ${phase === "baseline" ? "baseline" : phase === "review" ? "review" : "latest"}`,
        due: date,
        version: instrument.version,
        assignment: "Fulfilled",
        response: "Submitted",
        review: "Reviewed",
        reviewNote: "Fictional coded item responses for report demonstration.",
        reviewActor: "Jess Taylor",
        reviewDate: date,
        assessmentProgress: "Completed",
        answers: measureSampleAnswers(instrument.measureKey, phase),
        attempts: [{
          id: attemptId,
          date,
          channel: "SMS link",
          status: "Sample link opened",
          respondentName: person.name,
        }],
        submittedAt: date,
        submittedAttemptId: attemptId,
        link: "Ended",
        respondent: "Person",
        respondentName: person.name,
        recorder: "Person",
        recorderName: person.name,
        assistance: "Independent",
        channel: "SMS link",
        source: "Fictional item-capture fixture; approved measure wording not configured",
      };
    }),
  );
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

  const fixtures = [
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
  const phases = ["baseline", "review", "latest"];
  return fixtures.map((measure) =>
    measure.key === "iar-dst"
      ? measure
      : {
          ...measure,
          records: measure.records.map((entry, index) => {
            const { clinicallySignificant, ...change } = entry.change || {};
            return {
              ...entry,
              value: measureSampleScore(measure.key, phases[index]),
              sourceCollectionId: measureSampleCollectionId(measure.key, phases[index]),
              change:
                measure.key === "k10-plus" && index === 2
                  ? { direction: "deteriorated", label: "Increased since prior review" }
                  : change,
              notes: "Fictional score calculated from the linked sample item responses; no clinical interpretation is calculated.",
            };
          }),
        },
  );
}

function syncMeasureSampleRecord(episode, collection, recordedBy) {
  const instrument = getInstrument(collection.version);
  if (!instrument?.measureKey) return;
  const value = sampleMeasureTotal(instrument, collection.answers);
  if (value === null) return;
  episode.reportOutcomeMeasures ??= [];
  let measure = episode.reportOutcomeMeasures.find(
    (item) => item.key === instrument.measureKey,
  );
  if (!measure) {
    const ranges = {
      "k10-plus": [10, 50],
      k5: [5, 25],
      sdq: [0, 40],
      sidas: [0, 50],
      "who-5": [0, 100],
    };
    measure = {
      key: instrument.measureKey,
      scoreRange: ranges[instrument.measureKey],
      records: [],
    };
    episode.reportOutcomeMeasures.push(measure);
  }
  const existing = measure.records.find(
    (record) => record.sourceCollectionId === collection.id,
  );
  const details = {
    date: collection.submittedAt?.slice(0, 10) || TODAY,
    value,
    status: "Complete",
    category: null,
    context: "Review",
    recordedBy,
    notes: "Raw demonstration score from linked sample item responses; no clinical interpretation assigned.",
    sourceCollectionId: collection.id,
    change: null,
  };
  if (existing) Object.assign(existing, details);
  else measure.records.push({ id: `OM-${collection.id}`, ...details });
  if (instrument.measureKey === "k10-plus") {
    episode.k10Responses ??= [];
    const k10 = episode.k10Responses.find(
      (record) => record.sourceCollectionId === collection.id,
    );
    const response = {
      date: details.date,
      response: "Submitted",
      scoringMethod: K10_SCORING_METHOD,
      answers: collection.answers.map((answer) => Number.parseInt(answer, 10)),
      sourceCollectionId: collection.id,
      respondentName: collection.respondentName,
      recorderName: collection.recorderName,
      source: "Linked fictional K10 core-item response",
    };
    if (k10) Object.assign(k10, response);
    else episode.k10Responses.push({ id: `K10-${collection.id}`, ...response });
  }
}

function createMockFullReportPerson() {
  const id = "YS-1034";
  const episodeId = "EP-1034-01";
  const person = {
    id,
    name: "Jordan Ellis",
    dob: "2009-02-12",
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
          today: SAMPLE_DATE,
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
        ...reportMeasureCollections(person),
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
          end: "2026-09-12",
          status: "Delivered · fictional demo record",
        },
      ],
      appointments: [
        {
          id: "APT-7-baseline",
          appointmentType: "Initial assessment",
          plannedDate: "2026-06-16",
          plannedTime: "10:00",
          plannedDurationMinutes: 60,
          practitionerService: "Jess Taylor · Northside Centre",
          location: "Northside Centre",
          deliveryMode: "In person",
          attendance: "Attended",
          actualDate: "2026-06-16",
          actualTime: "10:00",
          actualDurationMinutes: 60,
          notes:
            "Initial clinical assessment and clinic tablet check-ins.",
          outcomeNotes:
            "Baseline check-ins recorded on clinic tablet; admission goals agreed.",
          outcomeRecordedAt: "2026-06-16T11:30:00Z",
          outcomeRecordedBy: "Jess Taylor",
          timestamp: "2026-06-10T09:00:00Z",
          actor: "Sample fixture",
          role: "Clinician",
        },
        {
          id: "APT-7-four-weeks",
          appointmentType: "Care review",
          plannedDate: "2026-07-14",
          plannedTime: "09:30",
          plannedDurationMinutes: 45,
          practitionerService: "Jess Taylor · Northside Centre",
          location: "Northside Centre",
          deliveryMode: "In person",
          attendance: "Attended",
          actualDate: "2026-07-14",
          actualTime: "09:35",
          actualDurationMinutes: 45,
          notes: "4-week progress review with clinic tablet check-ins.",
          outcomeNotes:
            "4-week check-ins discussed; positive routine adjustments.",
          outcomeRecordedAt: "2026-07-14T11:00:00Z",
          outcomeRecordedBy: "Jess Taylor",
          timestamp: "2026-07-08T09:00:00Z",
          actor: "Sample fixture",
          role: "Clinician",
        },
        {
          id: "APT-7-eight-weeks",
          appointmentType: "Care review",
          plannedDate: "2026-08-11",
          plannedTime: "09:30",
          plannedDurationMinutes: 45,
          practitionerService: "Jess Taylor · Northside Centre",
          location: "Northside Centre",
          deliveryMode: "In person",
          attendance: "Attended",
          actualDate: "2026-08-11",
          actualTime: "09:30",
          actualDurationMinutes: 40,
          notes: "8-week care review with clinic tablet check-ins.",
          outcomeNotes:
            "8-week check-ins discussed with Jordan; agreed continuation of support plan.",
          outcomeRecordedAt: "2026-08-11T11:00:00Z",
          outcomeRecordedBy: "Jess Taylor",
          timestamp: "2026-08-05T09:00:00Z",
          actor: "Sample fixture",
          role: "Clinician",
        },
        {
          id: "APT-7-twelve-weeks",
          appointmentType: "Care review",
          plannedDate: "2026-09-08",
          plannedTime: "10:00",
          plannedDurationMinutes: 60,
          practitionerService: "Jess Taylor · Northside Centre",
          location: "Northside Centre",
          deliveryMode: "In person",
          attendance: "Attended",
          actualDate: "2026-09-08",
          actualTime: "10:05",
          actualDurationMinutes: 55,
          notes:
            "12-week care review with clinic tablet check-ins.",
          outcomeNotes:
            "Clinic tablet check-ins received; formal questionnaire review remained pending.",
          outcomeRecordedAt: "2026-09-08T11:30:00Z",
          outcomeRecordedBy: "Jess Taylor",
          timestamp: "2026-09-02T10:00:00Z",
          actor: "Sample fixture",
          role: "Clinician",
        },
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
          notes: "Clinic attendance record still awaiting reconciliation after the planned review time.",
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
          practitionerService: "Jess Taylor · Northside Centre",
          location: "Northside Centre",
          deliveryMode: "Video",
          attendance: "Planned",
          notes: "Video review of current support goals and preferred follow-up arrangements.",
          timestamp: "2026-09-12T10:00:00Z",
          actor: "Sample fixture",
          role: "Clinician",
        },
        {
          id: "APT-7-attended",
          appointmentType: "Follow-up contact",
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
          notes: "Phone check-in following the missed group session and cancelled outreach contact.",
          outcomeNotes: "Jordan confirmed video as the preferred format for the 23 Sep review; group participation to be revisited.",
          outcomeRecordedAt: "2026-09-12T15:00:00Z",
          outcomeRecordedBy: "Jess Taylor",
          clinicalSummary: {
            sessionObjective: "Check contact preferences and agree follow-up after missed and cancelled contacts.",
            notePreview: "Jordan preferred a video review on 23 Sep; group participation remains to be discussed.",
            riskIndicator: "No risk assessment recorded in this contact",
            outcomeMeasures: ["WHO-5 response dated 8 Sep", "IAR-DST follow-up outstanding"],
            tasks: ["Confirm group programme follow-up"],
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
          outcomeNotes: "Community worker unavailable; follow-up contact offered by phone.",
          outcomeRecordedAt: "2026-09-08T16:00:00Z",
          outcomeRecordedBy: "Jess Taylor",
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
          outcomeNotes: "Jordan did not attend the scheduled group session; contact preference to be checked.",
          outcomeRecordedAt: "2026-09-05T10:30:00Z",
          outcomeRecordedBy: "Jess Taylor",
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
        sourceCollectionId: {
          "2026-06-16": measureSampleCollectionId("k10-plus", "baseline"),
          "2026-08-11": measureSampleCollectionId("k10-plus", "review"),
          "2026-09-08": measureSampleCollectionId("k10-plus", "latest"),
        }[date] || null,
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
        {
          key: "start", date: "2026-06-15", title: "Care episode started", eventType: "care-transition",
          detail: "Intake outcome recorded and follow-up assigned to Jess Taylor.",
          fields: { source: "Completed intake", impact: "Initial assessment planned for 16 Jun." },
        },
        {
          key: "group", date: "2026-07-06", title: "Group programme added", eventType: "care-transition",
          detail: "Group programme added alongside individual community support.",
          fields: { source: "Care coordination note", impact: "Group sessions included in the current care period." },
        },
        {
          key: "housing", date: "2026-07-22", title: "Temporary accommodation changed", eventType: "housing",
          detail: "Jordan reported a change in temporary accommodation.",
          fields: { source: "Jordan (self-report)", impact: "Confirm safe contact details and travel arrangements at the next review." },
        },
        {
          key: "med-review", date: "2026-08-03", title: "Medication list discrepancy reported", eventType: "other",
          detail: "Jordan said the medication list in the referral paperwork may be out of date. The care team requested confirmation from the prescriber.",
          fields: { source: "Jordan (self-report)", impact: "Reconcile the medication record with the prescriber; no medication change recorded here." },
        },
        {
          key: "med-adverse", date: "2026-08-24", title: "Possible medication side effect reported", eventType: "medication-adverse",
          detail: "Jordan reported dizziness while medication course B was active; causation was not established.",
          fields: { medicationName: "Medication course B", source: "Jordan (self-report)", impact: "Prescriber follow-up requested; no medication change recorded here." },
        },
        {
          key: "inpatient", date: "2026-06-15", title: "Inpatient discharge handover received", eventType: "inpatient",
          detail: "A discharge handover was received before community care began. The inpatient stay itself is outside this care period.",
          fields: { source: "Fictional discharge handover", impact: "Confirm follow-up arrangements at the initial assessment on 16 Jun." },
        },
      ].map(({ key, date, title, eventType, detail, fields }) => ({
        id: `E-7-${key}`,
        date,
        eventDate: date,
        timestamp: `${date}T${key === "inpatient" ? "08" : "09"}:00:00Z`,
        title,
        detail,
        fields,
        actionType: "ADD_CARE_EVENT",
        eventType,
        actor: "Sample fixture",
        role: "Clinician",
      })),
    },
  ];
  return person;
}

function ensureJordanFutureAssessment(state) {
  const episode = state.people.find((person) =>
    person.id === "YS-1034" && person.fixtureLabel === "Fictional full-report example",
  )?.episodes.find((item) => item.id === "EP-1034-01");
  const id = "A-7-life-care-sixteen-weeks";
  if (!episode || episode.collections.some((item) => item.id === id)) return state;
  const next = structuredClone(state);
  next.people.find((person) => person.id === "YS-1034")
    .episodes.find((item) => item.id === "EP-1034-01")
    .collections.push({
      id,
      label: "Life and care check-in · 16 weeks",
      due: "2026-10-06",
      version: LIKERT_INSTRUMENT.version,
      assignment: "Planned",
      response: "Not started",
      review: "Pending",
      link: "Not sent",
      appointmentId: null,
      attempts: [],
      answers: [],
      respondent: "Person",
      recorder: "Person",
      assistance: "Independent",
    });
  return next;
}

function repairJordanAssessmentAppointments(state) {
  if (state.jordanAssessmentAppointmentRevision === 1) return state;
  const jordan = state.people.find((person) =>
    person.id === "YS-1034" && person.fixtureLabel === "Fictional full-report example",
  );
  const episode = jordan?.episodes.find((item) => item.id === "EP-1034-01");
  if (!episode) return state;
  const next = structuredClone(state);
  const updated = next.people.find((person) => person.id === jordan.id)
    .episodes.find((item) => item.id === episode.id);
  const fixtureAppointments = createMockFullReportPerson().episodes[0].appointments;
  updated.appointments ??= [];
  for (const collection of updated.collections ?? []) {
    const match = /^A-7-(?:life-care|everyday-life)-(starting-point|four-weeks|eight-weeks|twelve-weeks)$/.exec(collection.id);
    if (!match) continue;
    if (collection.channel === "SMS link") {
      collection.appointmentId = null;
      collection.submittedAppointmentId = null;
      for (const attempt of collection.attempts ?? []) {
        if (attempt.channel === "SMS link") delete attempt.appointmentId;
      }
      continue;
    }
    if (!["Clinic tablet", "Clinician entry"].includes(collection.channel)) continue;
    const expectedId = samplePointAppointmentId(collection.id, match[1]);
    const fixtureAppointment = fixtureAppointments.find((item) => item.id === expectedId);
    if (fixtureAppointment && appointmentMatchesCollectionDate(fixtureAppointment, collection) &&
        !updated.appointments.some((item) => item.id === expectedId))
      updated.appointments.push(structuredClone(fixtureAppointment));
    const appointment = updated.appointments.find((item) =>
      item.id === expectedId && item.attendance === "Attended" &&
      appointmentMatchesCollectionDate(item, collection));
    if (!appointment) continue;
    collection.appointmentId = appointment.id;
    if (collection.response === "Submitted") collection.submittedAppointmentId = appointment.id;
    for (const attempt of collection.attempts ?? []) {
      if (["Clinic tablet", "Clinician entry"].includes(attempt.channel))
        attempt.appointmentId = appointment.id;
    }
  }
  next.jordanAssessmentAppointmentRevision = 1;
  return next;
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
          today: SAMPLE_DATE,
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
        nextAction: "Agree a safe contact route with River and record the intake outcome",
        reviewDate: "2026-09-24",
      },
    ],
  };
}

function improveRiverIntakeSummary(state) {
  const person = state.people.find((item) => item.id === "YS-1031" && item.name === "River Morgan");
  const intake = person?.intakes?.find((item) => item.id === "IN-YS-1031");
  if (
    intake?.status !== "In progress" ||
    intake.nextAction !== "Confirm identity and contact arrangements" ||
    intake.reviewDate !== SAMPLE_DATE
  ) return state;
  const next = structuredClone(state);
  const updated = next.people.find((item) => item.id === "YS-1031").intakes.find((item) => item.id === "IN-YS-1031");
  updated.nextAction = "Agree a safe contact route with River and record the intake outcome";
  updated.reviewDate = "2026-09-24";
  return next;
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
          today: SAMPLE_DATE,
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
          today: SAMPLE_DATE,
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
        appointments: [
          {
            id: "APT-YS-1033-initial",
            appointmentType: "Initial assessment",
            plannedDate: "2026-09-22",
            plannedTime: "11:00",
            plannedDurationMinutes: 60,
            practitionerService: "Jess Taylor · Northside Centre",
            location: "Northside Centre",
            deliveryMode: "In person",
            attendance: "Planned",
            notes:
              "Intake completed · initial clinical assessment scheduled.",
            timestamp: "2026-09-10T09:30:00Z",
            actor: "Sample fixture",
            role: "Clinician",
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

function createMockClosurePerson() {
  const person = createMockIntakeAssessmentPerson();
  person.id = "YS-DEMO-CLOSE";
  person.name = "Leila Morgan";
  person.dob = "2007-05-21";
  person.pronouns = "She/her";
  person.fixtureLabel = "Fictional closed episode with patient follow-up";
  const episode = person.episodes[0];
  episode.id = "EP-YS-DEMO-CLOSE-01";
  episode.status = "Closed";
  episode.start = "2026-08-12";
  episode.end = "2026-09-12";
  episode.disposition = "Admitted";
  episode.reason = "Planned support completed; final patient check-in requested.";
  episode.closureCategory = "Planned care completed";
  episode.handoverStatus = "Not applicable";
  episode.finalMeasureStatus = "Outstanding";
  episode.nextCareStep = "Review closure assessment and patient feedback.";
  episode.nextCareOwner = "Jess Taylor";
  episode.appointments = [];
  episode.collections = closureCollections(person, episode);
  episode.events = [
    { id: "E-YS-DEMO-CLOSE-closure", date: "2026-09-12", title: "Care episode closed", detail: "Planned support completed; closure assessment and care experience feedback assigned to Leila." },
    { id: "E-YS-DEMO-CLOSE-started", date: "2026-08-12", title: "Care episode started", detail: "Fictional support episode." },
  ];
  const intake = person.intakes[0];
  intake.id = "IN-YS-DEMO-CLOSE";
  intake.episodeId = episode.id;
  intake.consentRecorded = true;
  intake.consentReference = "Fictional completed-intake consent record";
  intake.receivedAt = "2026-08-10T14:00:00";
  intake.decisionAt = "2026-08-12T09:00:00";
  intake.summary = "Intake completed before the fictional care episode.";
  intake.history = [];
  return enrichMockClosurePerson(person);
}

function enrichMockClosurePerson(person) {
  if (person?.id !== "YS-DEMO-CLOSE" ||
      person.fixtureLabel !== "Fictional closed episode with patient follow-up") return person;
  const episode = person.episodes.find((item) => item.id === "EP-YS-DEMO-CLOSE-01");
  const intake = person.intakes?.find((item) => item.episodeId === episode?.id);
  if (!episode || !intake) return person;

  intake.reviewer ||= "Jess Taylor";
  intake.checkEvidence ||= "Fictional referral, participation and triage checks reviewed.";
  if (!intake.summary || intake.summary === "Intake completed before the fictional care episode.")
    intake.summary = "Fictional intake reviewed by Jess Taylor; proceed decision and receiving assessment owner recorded.";
  intake.history ??= [];
  if (!intake.history.some((entry) => entry.id === "IN-YS-DEMO-CLOSE-reviewed"))
    intake.history.push({
      id: "IN-YS-DEMO-CLOSE-reviewed",
      timestamp: "2026-08-12T09:00:00Z",
      actor: "Jess Taylor",
      title: "Intake reviewed · Proceed",
      detail: "Required checks reviewed and assessment ownership recorded for this fictional example.",
    });

  episode.programStream ||= "General";
  episode.carePeriods ??= [];
  if (!episode.carePeriods.length) episode.carePeriods.push({
    id: `${episode.id}-starting-level`,
    episodeId: episode.id,
    startDate: episode.start,
    endDateExclusive: nextDate(episode.end),
    programStream: "General",
    careLevel: "Mid",
    deliveringUnit: "Northside Centre",
    entryReason: "Fictional starting level recorded for this example",
    triggeringReviewId: null,
    authorisingPractitionerId: "jess",
    authorisingPractitioner: "Jess Taylor",
    actor: "Sample fixture",
    timestamp: "2026-08-12T09:00:00Z",
  });

  episode.appointments ??= [];
  for (const [key, date, type, duration, note] of [
    ["initial", "2026-08-14", "Initial assessment", 60, "Earlier questionnaire responses collected at the initial assessment."],
    ["midpoint", "2026-09-02", "Care review", 45, "Progress responses discussed and final next steps considered."],
  ]) {
    const id = `APT-YS-DEMO-CLOSE-${key}`;
    if (episode.appointments.some((item) => item.id === id)) continue;
    episode.appointments.push({
      id, appointmentType: type, plannedDate: date, plannedTime: "10:00",
      plannedDurationMinutes: duration, practitionerService: "Jess Taylor · Northside Centre",
      location: "Northside Centre", deliveryMode: "In person", attendance: "Attended",
      actualDate: date, actualTime: "10:00", actualDurationMinutes: duration,
      notes: note, outcomeNotes: note, outcomeRecordedAt: `${date}T11:30:00Z`,
      outcomeRecordedBy: "Jess Taylor", timestamp: `${date}T09:00:00Z`,
      actor: "Sample fixture", role: "Clinician",
    });
  }

  const history = [
    ["initial", "Initial assessment", "2026-08-14", VERSION, sampleAnswersFor(1, "baseline")],
    ["midpoint", "Progress assessment", "2026-09-02", VERSION, sampleAnswersFor(1, "current")],
    ["k10-start", "K10+ sample · starting point", "2026-08-14", measureInstrument("k10-plus").version, measureSampleAnswers("k10-plus", "baseline")],
    ["k10-review", "K10+ sample · review", "2026-09-02", measureInstrument("k10-plus").version, measureSampleAnswers("k10-plus", "review")],
  ];
  for (const [key, label, date, version, answers] of history) {
    const id = `A-YS-DEMO-CLOSE-${key}`;
    if (episode.collections.some((item) => item.id === id)) continue;
    episode.collections.push({
      id, label, due: date, version,
      readOnly: true,
      assignment: "Fulfilled", response: "Submitted", review: "Reviewed",
      reviewNote: "Fictional response reviewed during the care episode; retained as historical evidence.",
      reviewActor: "Jess Taylor", reviewDate: date,
      assessmentProgress: "Completed", answers,
      attempts: [{ id: `${id}-sample-session`, date, channel: "Clinic tablet", status: "Session started (sample)", respondentName: person.name }],
      submittedAt: date, submittedAttemptId: `${id}-sample-session`,
      link: "Ended", respondent: "Person", respondentName: person.name,
      recorder: "Person", recorderName: person.name,
      assistance: "Independent", channel: "Clinic tablet",
    });
  }
  for (const collection of episode.collections.filter((item) => item.readOnly && item.version === measureInstrument("k10-plus").version))
    syncMeasureSampleRecord(episode, collection, "Jess Taylor");
  for (const collection of episode.collections.filter((item) => item.readOnly)) {
    const appointmentId = `APT-YS-DEMO-CLOSE-${collection.due === "2026-08-14" ? "initial" : "midpoint"}`;
    collection.appointmentId ??= appointmentId;
    collection.submittedAppointmentId ??= appointmentId;
    for (const attempt of collection.attempts ?? [])
      if (["Clinic tablet", "Clinician entry"].includes(attempt.channel)) attempt.appointmentId ??= appointmentId;
  }

  episode.events ??= [];
  const levelEvent = {
    id: "E-YS-DEMO-CLOSE-level", date: "2026-08-12", title: "Starting care level recorded",
    detail: "General stream · Mid level · fictional starting level", actionType: "SET_INITIAL_CARE_LEVEL",
  };
  if (!episode.events.some((item) => item.id === levelEvent.id)) episode.events.push(levelEvent);
  for (const event of [
    { id: "E-YS-DEMO-CLOSE-started", date: "2026-08-12", title: "Care episode started", detail: "Fictional support episode.", eventType: "care-transition", fields: { source: "Reviewed fictional intake", impact: "Initial assessment arranged." } },
    { id: "E-YS-DEMO-CLOSE-plan", date: "2026-08-14", title: "Care plan agreed", detail: "Leila and Jess recorded priorities for the fictional support episode.", eventType: "other", fields: { source: "Fictional care planning conversation", impact: "Review priorities at the next assessment." } },
    { id: "E-YS-DEMO-CLOSE-review", date: "2026-09-02", title: "Care progress reviewed", detail: "Earlier questionnaire responses were reviewed; final next steps were discussed.", eventType: "other", fields: { source: "Fictional review conversation", impact: "Prepare episode closure and invite Leila's final perspective." } },
    { id: "E-YS-DEMO-CLOSE-closure", date: "2026-09-12", title: "Care episode closed", detail: "Planned support completed; closure assessment and care experience feedback assigned to Leila.", eventType: "care-transition", fields: { source: "Fictional episode closure", impact: "Closure questionnaires remain available for Leila to complete." } },
  ]) {
    const existing = episode.events.find((item) => item.id === event.id);
    if (!existing) episode.events.push({
      ...event, eventDate: event.date, timestamp: `${event.date}T09:00:00Z`,
      actionType: "ADD_CARE_EVENT", actor: "Sample fixture", role: "Clinician",
    });
    else {
      existing.eventDate ??= existing.date ?? event.date;
      existing.timestamp ??= `${event.date}T09:00:00Z`;
      existing.actionType ??= "ADD_CARE_EVENT";
      existing.eventType ??= event.eventType;
      existing.fields ??= event.fields;
      existing.actor ??= "Sample fixture";
      existing.role ??= "Clinician";
    }
  }

  addFictionalProgressReport(episode, {
    eventId: "E-YS-DEMO-CLOSE-report",
    timestamp: "2026-09-10T10:00:00Z",
    content: {
      summary: "Fictional episode report based on Leila's earlier submitted assessments. This is a demonstration record, not a clinical conclusion.",
      changes: "The two dated check-ins and K10+ sample item sets remain available as source records. Raw sample totals are displayed without a severity category or inferred clinical change.",
      interpretation: "Fictional clinician note: discuss Leila's own account and the agreed plan alongside the questionnaire responses.",
      nextSteps: "Close the planned care episode, then invite a separate closure assessment and care experience feedback response.",
    },
  });
  person.closureFixtureRevision = 4;
  return person;
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

function improveJordanFollowUpLabels(state) {
  const jordan = state.people.find(
    (person) => person.id === "YS-1034" && person.fixtureLabel === "Fictional full-report example",
  );
  if (!jordan?.episodes.some((episode) =>
    episode.collections.some((collection) =>
      collection.label === "Follow-up review" ||
      (collection.label.endsWith("· follow-up check-in") && collection.appointmentId &&
        !episode.appointments?.some((appointment) => appointment.id === collection.appointmentId &&
          appointmentMatchesCollectionDate(appointment, collection))))))
    return state;
  const next = JSON.parse(JSON.stringify(state));
  for (const episode of next.people.find((person) => person.id === "YS-1034").episodes) {
    for (const collection of episode.collections) {
      if (collection.label !== "Follow-up review" && !collection.label.endsWith("· follow-up check-in")) continue;
      if (collection.label === "Follow-up review") {
        const instrument = getInstrument(collection.version);
        collection.label = `${instrument?.name || "Assessment"} · follow-up check-in`;
      }
      const appointment = episode.appointments?.find((item) => item.id === collection.appointmentId);
      const oldNote = `Associated appointment for follow-up assessment (Follow-up review · ${collection.channel})`;
      if (appointment?.notes === oldNote)
        appointment.notes = `Associated appointment for follow-up assessment (${collection.label} · ${collection.channel})`;
      if (appointment && !appointmentMatchesCollectionDate(appointment, collection)) {
        if (collection.submittedAppointmentId === appointment.id) collection.submittedAppointmentId = null;
        for (const attempt of collection.attempts ?? []) {
          if (attempt.appointmentId === appointment.id) attempt.appointmentId = null;
        }
        collection.appointmentId = null;
      }
    }
  }
  return next;
}

function removeJordanOutlierFollowUp(state) {
  if (state.jordanOutlierFollowUpRemoved) return state;
  const jordan = state.people.find(
    (person) => person.id === "YS-1034" && person.fixtureLabel === "Fictional full-report example",
  );
  const episode = jordan?.episodes.find((item) => item.id === "EP-1034-01");
  const collection = episode?.collections.find((item) =>
    item.label === "Your preferences and next steps · follow-up check-in" &&
    item.due === "2027-10-13" &&
    item.response === "Not started",
  );
  if (!collection) return state;
  const next = JSON.parse(JSON.stringify(state));
  const targetEpisode = next.people.find((person) => person.id === jordan.id)
    .episodes.find((item) => item.id === episode.id);
  targetEpisode.collections = targetEpisode.collections.filter((item) => item.id !== collection.id);
  targetEpisode.events = targetEpisode.events.filter((item) => item.collectionId !== collection.id);
  next.audit = next.audit.filter((item) => item.collectionId !== collection.id);
  next.jordanOutlierFollowUpRemoved = true;
  return next;
}

function removeJordanSep15UnstartedFollowUp(state) {
  const jordan = state.people.find((person) =>
    person.id === "YS-1034" && person.fixtureLabel === "Fictional full-report example",
  );
  const episode = jordan?.episodes.find((item) => item.id === "EP-1034-01");
  const obsoleteIds = new Set((episode?.collections ?? [])
    .filter((item) =>
      item.label === "Your preferences and next steps · follow-up check-in" &&
      item.due === "2026-09-15" &&
      item.assignment === "Active" &&
      item.response === "Not started",
    )
    .map((item) => item.id));
  if (!obsoleteIds.size) return state;
  const next = JSON.parse(JSON.stringify(state));
  const targetEpisode = next.people.find((person) => person.id === jordan.id)
    .episodes.find((item) => item.id === episode.id);
  targetEpisode.collections = targetEpisode.collections.filter((item) => !obsoleteIds.has(item.id));
  targetEpisode.events = (targetEpisode.events ?? []).filter((item) => !obsoleteIds.has(item.collectionId));
  next.audit = (next.audit ?? []).filter((item) => !obsoleteIds.has(item.collectionId));
  return next;
}

export function upgradeSampleData(state) {
  if (state.terminologyRevision !== 1) {
    state = JSON.parse(JSON.stringify(state));
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
  if (state.people.some((person) => person.episodes.some((episode) =>
    episode.collections.some((collection) => collection.version === "Demo check-in v2.0")))) {
    state = JSON.parse(JSON.stringify(state));
    for (const person of state.people) {
      for (const episode of person.episodes) {
        for (const collection of episode.collections) {
          if (collection.version === "Demo check-in v2.0") collection.version = VERSION;
        }
      }
    }
  }
  if (state.sampleRevision < 28 || !state.sampleRevision)
    return withSampleFixtures(improveRiverIntakeSummary(removeJordanSep15UnstartedFollowUp(removeJordanOutlierFollowUp(improveJordanFollowUpLabels(prepareQualityState(prepareSeed(JSON.parse(JSON.stringify(state)))))))));
  const jordanFixture = state.people.find(
    (person) => person.id === "YS-1034" && person.fixtureLabel === "Fictional full-report example",
  );
  if (jordanFixture?.dob === "2008-02-12") {
    state = JSON.parse(JSON.stringify(state));
    state.people.find((person) => person.id === "YS-1034").dob = "2009-02-12";
  }
  if (state.intakeRevision !== 3)
    state = prepareIntakes(JSON.parse(JSON.stringify(state)));
  state = state.consentRevision === 1
    ? state
    : prepareConsentRequests(JSON.parse(JSON.stringify(state)));
  state = state.qualityRevision === 1
    ? state
    : prepareQualityState(JSON.parse(JSON.stringify(state)));
  const earlierClosureExample = state.people.find((person) =>
    person.id === "YS-9901" &&
    person.fixtureLabel === "Fictional closed episode with patient follow-up");
  if (earlierClosureExample) {
    state = JSON.parse(JSON.stringify(state));
    state.people = state.people.map((person) => person.id === "YS-9901"
      ? JSON.parse(JSON.stringify(person).replaceAll("YS-9901", "YS-DEMO-CLOSE"))
      : person);
    remapPersonReferences(state, "YS-9901", "YS-DEMO-CLOSE");
  }
  if (!state.people.some((person) => person.id === "YS-DEMO-CLOSE")) {
    state = JSON.parse(JSON.stringify(state));
    state.people.push(createMockClosurePerson());
  }
  const closureExample = state.people.find((person) =>
    person.id === "YS-DEMO-CLOSE" &&
    person.fixtureLabel === "Fictional closed episode with patient follow-up");
  if (closureExample && closureExample.closureFixtureRevision !== 4) {
    state = JSON.parse(JSON.stringify(state));
    const person = state.people.find((item) => item.id === "YS-DEMO-CLOSE");
    const intake = person.intakes[0];
    intake.consentRecorded = true;
    intake.consentReference = "Fictional completed-intake consent record";
    enrichMockClosurePerson(person);
  }
  return withSampleFixtures(improveRiverIntakeSummary(removeJordanSep15UnstartedFollowUp(removeJordanOutlierFollowUp(improveJordanFollowUpLabels(state)))));
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

function remapPersonReferences(value, previousId, nextId) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (key === "personId" && child === previousId) value[key] = nextId;
    else remapPersonReferences(child, previousId, nextId);
  }
}

function moveMockAdmissionToCareStart(episode, eventId) {
  const admission = episode?.events?.find(
    (event) => event.id === eventId && event.actor === "Sample fixture",
  );
  if (admission?.eventDate !== "2026-08-30") return;
  admission.date = "2026-06-15";
  admission.eventDate = "2026-06-15";
  admission.timestamp = "2026-06-15T08:00:00Z";
}

function refreshRelationshipExamples(next) {
  for (const [seedIndex, personId] of [[0, "YS-1024"], [3, "YS-1027"]]) {
    const episode = next.people.find((person) => person.id === personId)?.episodes.find(
      (item) => item.status === "Active",
    );
    if (!episode) continue;
    episode.events ??= [];
    for (const example of sampleContextEventsForSeed(seedIndex)) {
      if (!episode.events.some((event) => event.id === example.id)) episode.events.push(example);
    }
  }
  for (const personId of ["YS-1029", "YS-1034"]) {
    const episode = next.people.find((person) => person.id === personId)?.episodes.find(
      (item) => item.status === "Active",
    );
    if (!episode) continue;
    for (const key of ["four-weeks", "twelve-weeks"]) {
      const collection = episode.collections.find((item) =>
        item.id === `${personId === "YS-1034" ? "A-7" : "A-6"}-everyday-life-${key}`,
      );
      const attempt = collection?.attempts?.find((item) => item.id === `${collection.id}-sample-session`);
      if (!collection || !attempt || collection.channel !== "Clinic tablet" ||
          attempt.status !== "Session started (sample)") continue;
      const expectedAppointment = samplePointAppointmentId(
        personId === "YS-1034" ? "A-7-everyday-life" : "A-6-everyday-life", key,
      );
      if (collection.appointmentId !== expectedAppointment) continue;
      collection.channel = "SMS link";
      collection.appointmentId = null;
      if (collection.submittedAppointmentId === expectedAppointment)
        collection.submittedAppointmentId = null;
      attempt.channel = "SMS link";
      if (attempt.appointmentId === expectedAppointment) delete attempt.appointmentId;
      attempt.status = "Sample link opened";
    }
  }
  const miaEpisode = next.people.find((person) => person.id === "YS-1029")?.episodes.find(
    (episode) => episode.id === "EP-1029-01",
  );
  if (miaEpisode) {
    const changedAppointment = miaEpisode.appointments?.find((item) => item.id === "APT-5-twelve-weeks");
    if (changedAppointment?.outcomeNotes === "12-week measures completed; significant wellbeing gains noted.")
      changedAppointment.outcomeNotes = sampleAppointmentsForSeed(5).find(
        (item) => item.id === changedAppointment.id,
      ).outcomeNotes;
    const revisedEvents = {
      "E-5-visual-care-transition": {
        title: "Group programme added",
        detail: "Mia agreed to try the weekly group alongside individual support; attendance is recorded in service contacts.",
        fields: { source: "Care planning discussion", impact: "Group sessions added to this care period." },
      },
      "E-5-visual-housing": {
        title: "Temporary accommodation changed",
        detail: "Mia reported staying with a family member while home repairs were completed.",
        fields: { source: "Mia (self-report)", impact: "Confirm safe contact and travel arrangements for the next visit." },
      },
      "E-5-visual-medication": {
        title: "Medication list confirmation requested",
        eventType: "other",
        detail: "Mia said the referral medication list may be out of date; the team requested confirmation from the prescriber.",
        fields: { source: "Mia (self-report)", impact: "Reconcile the medication record; no change is recorded by this event." },
      },
      "E-5-visual-medication-adverse": {
        title: "Possible medication side effect reported",
        detail: "Mia reported nausea and asked whether it could relate to medication. Medication details and causation were not confirmed.",
        fields: { source: "Mia (self-report)", impact: "Prescriber follow-up requested; no medication change recorded here." },
      },
      "E-5-visual-inpatient": {
        title: "Inpatient discharge handover received",
        detail: "A discharge handover was received before community support began. The inpatient stay is outside this care period.",
        fields: { source: "Fictional discharge handover", impact: "Confirm follow-up arrangements at the initial assessment." },
      },
    };
    for (const event of miaEpisode.events ?? []) {
      const revised = revisedEvents[event.id];
      if (revised && event.actor === "Sample fixture" &&
          event.detail?.startsWith("Fictional demo record of")) Object.assign(event, revised);
    }
    const correction = next.audit?.find((item) => item.id === "AUD-5-collection-correction");
    if (correction?.source === "Clinic completion record · fictional demo source" &&
        correction.changes?.[0]?.before === "SMS link") {
      correction.reason = "Corrected the delivery channel and support level from the SMS completion log.";
      correction.source = "SMS completion log · fictional demo source";
      correction.changes[0].before = "Clinic tablet";
      correction.changes[0].after = "SMS link";
    }
  }
  const jordan = next.people.find((person) =>
    person.id === "YS-1034" && person.fixtureLabel === "Fictional full-report example",
  );
  const jordanEpisode = jordan?.episodes.find((episode) => episode.id === "EP-1034-01");
  if (jordanEpisode) {
    const fixture = createMockFullReportPerson().episodes[0];
    for (const eventId of ["E-7-inpatient", "E-7-med-review"]) {
      const event = jordanEpisode.events?.find((item) => item.id === eventId);
      const example = fixture.events.find((item) => item.id === eventId);
      if (event?.actor !== "Sample fixture" || !example) continue;
      if (["Inpatient admission recorded", "Medication reviewed"].includes(event.title)) {
        Object.assign(event, {
          title: example.title,
          detail: example.detail,
          eventType: example.eventType,
          fields: example.fields,
        });
      }
      if (eventId === "E-7-med-review" &&
          event.title === "Medication list discrepancy reported" && event.eventType === "medication")
        event.eventType = "other";
    }
  }
}

function prepareSeed(state) {
  const next = state;
  const jordanFixture = createMockFullReportPerson();
  const jordanIdCollision = next.people.find(
    (person) =>
      person.id === jordanFixture.id && person.name !== jordanFixture.name,
  );
  if (jordanIdCollision) {
    const replacementId = `YS-${
      Math.max(
        1034,
        ...next.people
          .map((person) => Number(person.id.slice(3)))
          .filter(Number.isFinite),
      ) + 1
    }`;
    jordanIdCollision.id = replacementId;
    remapPersonReferences(next, jordanFixture.id, replacementId);
  }
  next.people = next.people.filter((person) => person.id !== "YS-1030");
  for (const fixture of [
    createMockIntakePerson(),
    createMockIntakeOutcomePerson(),
    createMockIntakeAssessmentPerson(),
    createMockClosurePerson(),
    jordanFixture,
  ]) {
    if (!next.people.some((person) => person.id === fixture.id))
      next.people.push(fixture);
  }
  const jordan = next.people.find((person) => person.id === "YS-1034");
  if (jordan?.fixtureLabel === "Fictional full-report example" && jordan.dob === "2008-02-12")
    jordan.dob = "2009-02-12";
  const jordanEpisode = jordan?.episodes.find((episode) => episode.id === "EP-1034-01");
  const jordanFixtureAppointments = jordanFixture.episodes[0].appointments;
  const jordanFixtureMeasures = jordanFixture.episodes[0].reportOutcomeMeasures;
  if (jordanEpisode) {
    moveMockAdmissionToCareStart(jordanEpisode, "E-7-inpatient");
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
        if (existing.id === "APT-7-eight-weeks" &&
            existing.outcomeNotes === "8-week questionnaire reviewed with Mia; agreed continuation of support plan.")
          existing.outcomeNotes = appointment.outcomeNotes;
        if (existing.id === "APT-7-four-weeks" &&
            existing.outcomeNotes === "Reviewed 4-week questionnaire responses; positive routine adjustments.")
          existing.outcomeNotes = appointment.outcomeNotes;
        if (existing.id === "APT-7-baseline" &&
            existing.outcomeNotes === "Baseline measures recorded on clinic tablet; admission goals agreed.")
          existing.outcomeNotes = appointment.outcomeNotes;
        const legacyReviewNotes = {
          "APT-7-baseline": "Initial comprehensive clinical assessment and baseline questionnaire.",
          "APT-7-four-weeks": "4-week progress check-in and clinic tablet questionnaire.",
          "APT-7-eight-weeks": "8-week check-in and clinic tablet questionnaire.",
        };
        if (legacyReviewNotes[existing.id] && existing.notes === legacyReviewNotes[existing.id])
          existing.notes = appointment.notes;
        if (existing.id === "APT-7-twelve-weeks") {
          if (["12-week review and longitudinal assessment battery completion.",
            "12-week review of submitted check-ins and outcome measures."].includes(existing.notes))
            existing.notes = appointment.notes;
          if (["Completed 12-week outcome questionnaires; progress report prepared.",
            "12-week questionnaire responses reviewed; progress report prepared."].includes(existing.outcomeNotes))
            existing.outcomeNotes = appointment.outcomeNotes;
        }
        const legacyNotes = {
          "APT-7-overdue-plan": { notes: "Confirm attendance or record the outcome." },
          "APT-7-upcoming-plan": {
            notes: "Planned review of current support goals.",
            practitionerService: "Northside Centre",
          },
          "APT-7-attended": {
            notes: "Fictional completed contact.",
            outcomeNotes: "Next planned review retained.",
          },
          "APT-7-cancelled": { outcomeNotes: "Fictional cancellation; follow-up remains planned." },
          "APT-7-dna": { outcomeNotes: "Fictional non-attendance recorded; check preferred contact method." },
        }[existing.id] ?? {};
        for (const [key, oldValue] of Object.entries(legacyNotes)) {
          if (existing[key] === oldValue) existing[key] = appointment[key];
        }
        if (existing.id === "APT-7-attended" && existing.appointmentType === "Care review")
          existing.appointmentType = appointment.appointmentType;
        if (["APT-7-attended", "APT-7-cancelled", "APT-7-dna"].includes(existing.id) &&
            existing.outcomeRecordedBy === "Sample fixture")
          existing.outcomeRecordedBy = appointment.outcomeRecordedBy;
        if (existing.id === "APT-7-attended" && existing.clinicalSummary?.riskIndicator === "Low · review recorded")
          existing.clinicalSummary = { ...appointment.clinicalSummary };
      }
    }
    const groupPeriod = jordanEpisode.servicePeriods?.find((period) => period.id === "SP-7-group");
    if (groupPeriod?.end === "2026-08-28") groupPeriod.end = "2026-09-12";
    for (const fixtureEvent of jordanFixture.episodes[0].events) {
      const existing = jordanEpisode.events?.find((event) => event.id === fixtureEvent.id);
      if (!existing || existing.actor !== "Sample fixture" ||
          existing.detail !== `Fictional demo record of ${existing.title.toLowerCase()}.`) continue;
      Object.assign(existing, {
        title: fixtureEvent.title,
        detail: fixtureEvent.detail,
        eventType: fixtureEvent.eventType,
        fields: existing.fields ?? fixtureEvent.fields,
      });
      if (existing.id === "E-7-med-adverse" && existing.eventDate === "2026-08-17") {
        existing.date = fixtureEvent.date;
        existing.eventDate = fixtureEvent.eventDate;
        existing.timestamp = fixtureEvent.timestamp;
      }
    }
    jordanEpisode.reportOutcomeMeasures = JSON.parse(JSON.stringify(jordanFixtureMeasures));
    for (const fixtureResponse of jordanFixture.episodes[0].k10Responses) {
      const existingResponse = jordanEpisode.k10Responses?.find(
        (item) => item.id === fixtureResponse.id,
      );
      if (existingResponse && fixtureResponse.sourceCollectionId)
        existingResponse.sourceCollectionId = fixtureResponse.sourceCollectionId;
    }
    jordanEpisode.collections ??= [];
    for (const collection of jordanFixture.episodes[0].collections.filter(
      (item) => item.id.startsWith("A-7-measure-"),
    )) {
      if (!jordanEpisode.collections.some((item) => item.id === collection.id))
        jordanEpisode.collections.push(collection);
    }
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
        detail: "Mia agreed to try the weekly group alongside individual support; attendance is recorded in service contacts.",
        fields: { source: "Care planning discussion", impact: "Group sessions added to this care period." },
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
        detail: "Mia reported staying with a family member while home repairs were completed.",
        fields: { source: "Mia (self-report)", impact: "Confirm safe contact and travel arrangements for the next visit." },
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
        title: "Medication list confirmation requested",
        detail: "Mia said the referral medication list may be out of date; the team requested confirmation from the prescriber.",
        fields: { source: "Mia (self-report)", impact: "Reconcile the medication record; no change is recorded by this event." },
        actionType: "ADD_CARE_EVENT",
        eventType: "other",
        actor: "Sample fixture",
        role: "Clinician",
      },
      {
        id: "E-5-visual-medication-adverse",
        date: "2026-08-17",
        eventDate: "2026-08-17",
        timestamp: "2026-08-17T09:00:00Z",
        title: "Possible medication side effect reported",
        detail: "Mia reported nausea and asked whether it could relate to medication. Medication details and causation were not confirmed.",
        fields: { source: "Mia (self-report)", impact: "Prescriber follow-up requested; no medication change recorded here." },
        actionType: "ADD_CARE_EVENT",
        eventType: "medication-adverse",
        actor: "Sample fixture",
        role: "Clinician",
      },
      {
        id: "E-5-visual-inpatient",
        date: "2026-06-15",
        eventDate: "2026-06-15",
        timestamp: "2026-06-15T08:00:00Z",
        title: "Inpatient discharge handover received",
        detail: "A discharge handover was received before community support began. The inpatient stay is outside this care period.",
        fields: { source: "Fictional discharge handover", impact: "Confirm follow-up arrangements at the initial assessment." },
        actionType: "ADD_CARE_EVENT",
        eventType: "inpatient",
        actor: "Sample fixture",
        role: "Clinician",
      },
    ]) {
      if (!miaEpisode.events.some((existing) => existing.id === event.id))
        miaEpisode.events.push(event);
    }
    moveMockAdmissionToCareStart(miaEpisode, "E-5-visual-inpatient");
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
          reason: "Corrected the delivery channel and support level from the SMS completion log.",
          source: "SMS completion log · fictional demo source",
          changes: [
            {
              key: `${collection.id}-channel`,
              label: `${collection.label} · Delivery channel`,
              before: "Clinic tablet",
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
          const [channel, sentAt, submittedAt, appointmentId] = history;
          if (appointmentId) {
            c.appointmentId ??= appointmentId;
            c.submittedAppointmentId ??= appointmentId;
          }
          c.attempts.push({
            id: `${c.id}-sample-session`,
            date: sentAt,
            channel,
            appointmentId: appointmentId || null,
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
        // Link any unlinked clinic tablet, clinician entry, or other delivery attempts to appointments
        if (["Clinic tablet", "Clinician entry"].includes(c.channel) || c.attempts.some(a => ["Clinic tablet", "Clinician entry"].includes(a.channel))) {
          if (!c.appointmentId) {
            const matching = (episode.appointments ?? []).find(
              (a) =>
                a.plannedDate === c.due ||
                a.actualDate === c.due ||
                a.plannedDate === c.submittedAt?.slice(0, 10) ||
                a.actualDate === c.submittedAt?.slice(0, 10),
            );
            if (matching) {
              c.appointmentId = matching.id;
              c.submittedAppointmentId ??= matching.id;
            }
          }
          for (const attempt of c.attempts) {
            if (!attempt.appointmentId) {
              const matching =
                (episode.appointments ?? []).find(
                  (a) =>
                    a.id === c.appointmentId ||
                    a.id === c.submittedAppointmentId ||
                    a.plannedDate === attempt.date ||
                    a.actualDate === attempt.date ||
                    a.plannedDate === c.due ||
                    a.actualDate === c.due,
                );
              if (matching) {
                attempt.appointmentId = matching.id;
                c.appointmentId ??= matching.id;
                c.submittedAppointmentId ??= matching.id;
              }
            }
          }
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
  for (let i = 0; i < seeds.length; i++) {
    const person = next.people.find((p) => p.id === `YS-${1024 + i}`);
    const episode = person?.episodes[0];
    if (episode) {
      episode.appointments ??= [];
      const sampleAppointments = sampleAppointmentsForSeed(i);
      for (const appointment of sampleAppointments) {
        const existing = episode.appointments.find(
          (item) => item.id === appointment.id,
        );
        if (!existing) {
          episode.appointments.push(appointment);
        } else {
          for (const [key, value] of Object.entries(appointment)) {
            if (existing[key] == null) existing[key] = value;
          }
        }
      }
    }
  }
  const jordanLee = next.people.find((p) => p.id === "YS-1033");
  const jordanLeeEpisode = jordanLee?.episodes[0];
  if (jordanLeeEpisode) {
    jordanLeeEpisode.appointments ??= [];
    const jordanLeeFixture = createMockIntakeAssessmentPerson();
    const jordanLeeAppt = jordanLeeFixture.episodes[0].appointments[0];
    if (
      jordanLeeAppt &&
      !jordanLeeEpisode.appointments.some((a) => a.id === jordanLeeAppt.id)
    ) {
      jordanLeeEpisode.appointments.push(jordanLeeAppt);
    }
  }
  refreshRelationshipExamples(next);
  next.sampleRevision = 28;
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
        sentAt: person.episodes[0]?.start || SAMPLE_DATE,
        decidedAt: person.episodes[0]?.start || SAMPLE_DATE,
        decisionMaker: person.name,
        history: [
          {
            status: "Sent",
            at: person.episodes[0]?.start || SAMPLE_DATE,
            actor: "Sample fixture",
          },
          {
            status: person.consent === "Withdrawn" ? "Withdrawn" : "Accepted",
            at: person.episodes[0]?.start || SAMPLE_DATE,
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
          today: SAMPLE_DATE,
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
        summary: "Sample intake reviewed before this care episode.",
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
  return withSampleFixtures(prepareQualityState(prepareSeed({
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
            programStream: "General",
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
                      attempts: [
                        {
                          id: `A-${i}-baseline-sample-session`,
                          date: "2026-06-15",
                          channel: "Clinic tablet",
                          appointmentId: `APT-${i}-baseline`,
                          status: "Session started (sample)",
                          respondentName: s[0],
                        },
                      ],
                      submittedAt: "2026-06-15",
                      submittedAttemptId: `A-${i}-baseline-sample-session`,
                      appointmentId: `APT-${i}-baseline`,
                      submittedAppointmentId: `APT-${i}-baseline`,
                      respondent: "Person",
                      respondentName: s[0],
                      recorder: "Person",
                      recorderName: s[0],
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
            appointments: sampleAppointmentsForSeed(i),
            events: [
              {
                id: `E-${i}`,
                date: s[3] === "90-day review" ? "2026-06-15" : "2026-09-08",
                title: "Care episode started",
                detail: "Initial assessment · baseline collection planned",
              },
              ...sampleContextEventsForSeed(i),
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
  })));
}

export function collectionStatus(c) {
  if (c.assignment === "Cancelled") return "Cancelled";
  if (c.assignment === "Paused") return "Paused";
  if (c.needsReview) return "Ready for review";
  if (c.response === "Submitted" && noClinicalReviewRequired(c))
    return "Completed";
  if (c.review === "Reviewed") return "Reviewed";
  if (c.response === "Submitted") return "Ready for review";
  if (!c.due) return "Needs planning";
  if (c.due < TODAY) return "Overdue";
  if (c.due === TODAY) return "Due today";
  return "Scheduled";
}
export const noClinicalReviewRequired = (c) =>
  c?.response === "Submitted" &&
  !c.needsReview &&
  (c.closureKind === "feedback" || c.channel === "Clinician entry" ||
    (c.channel === "Clinic tablet" && c.assistance === "Supported"));
export const hasPendingClinicalReview = (c) =>
  c?.response === "Submitted" &&
  !noClinicalReviewRequired(c) &&
  (c.review !== "Reviewed" || !!c.needsReview);
const closureFollowUpComplete = (episode) =>
  [
    ["assessment", CLOSURE_ASSESSMENT_VERSION],
    ["feedback", CLOSURE_FEEDBACK_VERSION],
  ].every(([kind, version]) => {
    const collection = episode.collections.find((item) =>
      item.closureKind === kind && item.version === version);
    return collection?.response === "Submitted" && !hasPendingClinicalReview(collection);
  });
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
    ...(state?.people || []).filter((p) => !p.archivedAt).flatMap((p) =>
      (p.episodes || [])
        .filter((e) => ["Active", "Closed"].includes(e.status) && canAssess(p, e))
        .flatMap((e) =>
          (e.collections || [])
            .filter(
              (c) =>
                canCollectInEpisode(e, c) &&
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
  if (action.type === "RESET_INTAKE_EXAMPLES") {
    const ids = new Set(["YS-1031", "YS-1032"]);
    const seed = createSeed();
    const originals = new Map(seed.people.filter((person) => ids.has(person.id)).map((person) => [person.id, person]));
    if ([...ids].some((id) => state.people.find((person) => person.id === id)?.name !== originals.get(id)?.name))
      return state;
    const resetToken = action.resetToken || uid();
    const issueIds = new Set(getQualityIssues(state)
      .filter((issue) => ids.has(issue.personId))
      .map((issue) => issue.id));
    return {
      ...state,
      people: state.people.map((person) => ids.has(person.id)
        ? { ...originals.get(person.id), intakeResetToken: resetToken }
        : person),
      issues: [
        ...state.issues.filter((issue) => !ids.has(issue.personId)),
        ...seed.issues.filter((issue) => ids.has(issue.personId)),
      ],
      audit: [
        ...state.audit.filter((entry) => !ids.has(entry.personId)),
        ...seed.audit.filter((entry) => ids.has(entry.personId)),
      ],
      qualityIssueWorkflow: Object.fromEntries(Object.entries(state.qualityIssueWorkflow || {})
        .filter(([id]) => !issueIds.has(id))),
    };
  }
  if (action.type === "UPGRADE_QUESTIONNAIRE_SAMPLES")
    return upgradeSampleData(state);
  if (
    [
      "ADD_PERSON",
      "SAVE_INTAKE",
      "UPDATE_INTAKE_DETAILS",
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
      version: INITIAL_ASSESSMENT_INSTRUMENT.version,
    });
  const next = JSON.parse(JSON.stringify(state));
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
  const completeClosureFollowUp = () => {
    if (e?.status !== "Closed" || !closureFollowUpComplete(e)) return;
    e.status = "Completed";
    e.completedAt = recordedAt;
    event(
      "Care episode completed",
      "Episode closure assessment and care experience feedback completed.",
      { actionType: "COMPLETE_CARE_EPISODE", collectionId: null },
    );
  };
  switch (action.type) {
    case "ADD_PERSON_TAG":
    case "REMOVE_PERSON_TAG": {
      if (!p || !staff || p.archivedAt) return state;
      const tag = typeof action.tag === "string" ? action.tag.trim() : "";
      const before = Array.isArray(p.tags) ? p.tags : [];
      const matching = before.find((item) => item.toLowerCase() === tag.toLowerCase());
      if (!tag) return state;
      if (action.type === "ADD_PERSON_TAG") {
        if (!PERSON_TAG_OPTIONS.includes(tag)) return state;
        if (matching || before.length >= 8) return state;
        p.tags = [...before, tag];
      } else {
        if (!matching) return state;
        p.tags = before.filter((item) => item !== matching);
      }
      next.audit.unshift({
        id: uid(),
        type: "person-tags",
        timestamp: recordedAt,
        date: recordedAt.slice(0, 10),
        personId: p.id,
        title: action.type === "ADD_PERSON_TAG" ? "Person tag added" : "Person tag removed",
        detail: matching || tag,
        actor: staff.name,
        actorId: staff.id,
        role: staff.role,
        changes: [{ key: "tags", label: "Tags", before: before.join(", "), after: p.tags.join(", ") }],
      });
      break;
    }
    case "ARCHIVE_PERSON":
    case "RESTORE_PERSON": {
      if (!p || !staff || !action.reason?.trim() ||
          (action.type === "ARCHIVE_PERSON" ? !!p.archivedAt : !p.archivedAt))
        return state;
      const archived = action.type === "ARCHIVE_PERSON";
      const prior = p.archivedAt || null;
      p.archivedAt = archived ? recordedAt : null;
      p.archivedBy = archived ? staff.name : null;
      next.audit.unshift({
        id: uid(),
        type: "person-archive",
        timestamp: recordedAt,
        date: recordedAt.slice(0, 10),
        personId: p.id,
        title: archived ? "Person archived" : "Person restored",
        detail: action.reason.trim(),
        actor: staff.name,
        actorId: staff.id,
        role: staff.role,
        changes: [{ key: "archivedAt", label: "Archive status", before: prior, after: p.archivedAt }],
      });
      break;
    }
    case "SET_INITIAL_CARE_LEVEL": {
      if (carePeriodError(e, action, staff, TODAY, DEMO_STAFF.filter((item) => item.role === "Clinician")))
        return state;
      e.programStream = e.programStream || action.programStream;
      const period = {
        id: uid(),
        episodeId: e.id,
        startDate: e.start,
        endDateExclusive: null,
        careLevel: action.careLevel,
        programStream: e.programStream,
        deliveringUnit: action.deliveringUnit.trim(),
        entryReason: "Starting level recorded",
        triggeringReviewId: null,
        authorisingPractitionerId: staff.id,
        authorisingPractitioner: staff.name,
        actor: staff.name,
        timestamp: recordedAt,
      };
      e.carePeriods = [period];
      event("Starting care level recorded", `${action.careLevel} · ${action.deliveringUnit.trim()} · effective ${e.start}`, {
        date: e.start,
        effectiveDate: e.start,
        carePeriodId: period.id,
        collectionId: null,
      });
      break;
    }
    case "CHANGE_CARE_LEVEL": {
      if (carePeriodError(e, action, staff, TODAY, DEMO_STAFF.filter((item) => item.role === "Clinician")))
        return state;
      if (!getInstrument(action.assessmentVersion) ||
          !INSTRUMENTS.some((instrument) => instrument.version === action.assessmentVersion) ||
          (action.newEpisodeId && p.episodes.some((episode) => episode.id === action.newEpisodeId)))
        return state;
      const previous = currentCarePeriod(e);
      const authoriser = DEMO_STAFF.find((item) => item.id === action.authorisingPractitionerId);
      const newEpisodeId = action.newEpisodeId || uid();
      const newEpisodeNumber = String(Math.max(0, ...p.episodes.map((episode) => Number(episode.number) || 0)) + 1).padStart(2, "0");
      const assessmentId = uid();
      const linkedIntake = intakeFor(p, e);
      const respondent = linkedIntake?.respondentPreference || "Person";
      const respondentName = respondent === "Family respondent" ? linkedIntake?.respondentName : p.name;
      previous.endDateExclusive = action.effectiveDate;
      const period = {
        id: uid(),
        episodeId: newEpisodeId,
        startDate: action.effectiveDate,
        endDateExclusive: null,
        careLevel: action.careLevel,
        programStream: action.programStream,
        deliveringUnit: action.deliveringUnit.trim(),
        previousCareLevel: previous.careLevel,
        entryReason: action.entryReason,
        triggeringReviewId: action.triggeringReviewId || null,
        authorisingPractitionerId: authoriser.id,
        authorisingPractitioner: authoriser.name,
        actor: staff.name,
        timestamp: recordedAt,
      };
      e.status = "Closed";
      e.end = previousDate(action.effectiveDate);
      e.closureCategory = action.closureCategory;
      e.reason = action.closureReason.trim();
      e.handoverStatus = "Not applicable";
      e.finalMeasureStatus = "Outstanding";
      e.nextEpisodeId = newEpisodeId;
      e.nextCareStep = `Continued in care episode ${newEpisodeNumber} at ${action.careLevel} level.`;
      e.collections.forEach((collection) => {
        if (collection.response !== "Submitted") {
          collection.assignment = "Cancelled";
          collection.link = "Revoked";
        }
      });
      const closureAssignments = closureCollections(p, e);
      e.collections.push(...closureAssignments);
      for (const assignment of closureAssignments) {
        event(
          "Closure questionnaire assigned",
          `${assignment.label} · ${p.name} · due ${formatDate(assignment.due)} · ${assignment.link === "Active" ? "sample link prepared, not sent" : "contact settings need review before link preparation"}`,
          { collectionId: assignment.id },
        );
      }
      event("Care episode closed for stream or level change", `${e.programStream} stream · ${previous.careLevel} to ${action.careLevel} · closure assessment and care experience feedback assigned · next episode ${newEpisodeNumber} starts ${action.effectiveDate}`, {
        actionType: "END_CARE_EPISODE_FOR_LEVEL_CHANGE",
        date: action.effectiveDate,
        effectiveDate: action.effectiveDate,
        carePeriodId: previous.id,
        fromCareLevel: previous.careLevel,
        toCareLevel: action.careLevel,
        fromProgramStream: e.programStream,
        toProgramStream: action.programStream,
        entryReason: action.entryReason,
        nextEpisodeId: newEpisodeId,
        nextEpisodeNumber: newEpisodeNumber,
        collectionId: null,
      });
      const newEpisode = {
        id: newEpisodeId,
        number: newEpisodeNumber,
        status: "Active",
        start: action.effectiveDate,
        programStream: action.programStream,
        disposition: "Continued care",
        owner: e.owner || p.owner,
        intakeId: linkedIntake?.id || null,
        previousEpisodeId: e.id,
        carePeriods: [period],
        collections: [{
          id: assessmentId,
          label: "Initial assessment",
          due: action.assessmentDue,
          version: action.assessmentVersion,
          assignment: "Planned",
          response: "Not started",
          review: "Pending",
          link: "Not sent",
          attempts: [],
          answers: [],
          respondent,
          respondentName,
          recorder: respondent,
          recorderName: respondentName,
        }],
        appointments: [],
        events: [{
          id: uid(),
          date: action.effectiveDate,
          effectiveDate: action.effectiveDate,
          timestamp: recordedAt,
          title: "Care episode started after level change",
          detail: `${action.programStream} stream · ${action.careLevel} level · initial assessment due ${action.assessmentDue}`,
          actionType: "CHANGE_CARE_LEVEL",
          personId: p.id,
          episodeId: newEpisodeId,
          previousEpisodeId: e.id,
          carePeriodId: period.id,
          collectionId: assessmentId,
          actor: staff.name,
          actorId: staff.id,
          role: staff.role,
        }],
      };
      newEpisode.events[0].changes = careChanges(null, newEpisode);
      p.episodes.unshift(newEpisode);
      break;
    }
    case "ADD_APPOINTMENT": {
      if (e?.status !== "Active" || appointmentError(e, action, TODAY))
        return state;
      const newAssessmentVersions = action.newAssessmentVersions ?? [];
      if (!Array.isArray(newAssessmentVersions) ||
          new Set(newAssessmentVersions).size !== newAssessmentVersions.length ||
          (newAssessmentVersions.length && !canAssess(p, e)) ||
          newAssessmentVersions.some((version) =>
            !INSTRUMENTS.some((instrument) => instrument.version === version)))
        return state;
      const appointment = {
        id: action.id || uid(),
        ...appointmentContent(action),
        timestamp: recordedAt,
        actor: staff?.name || "Not recorded",
        actorId: staff?.id || null,
        role: staff?.role || null,
      };
      e.appointments ??= [];
      e.appointments.unshift(appointment);
      for (const collectionId of action.collectionIds ?? (action.collectionId ? [action.collectionId] : []))
        e.collections.find((collection) => collection.id === collectionId).appointmentId = appointment.id;
      const assessmentDue = action.attendance === "Attended"
        ? action.actualDate : action.plannedDate;
      for (const version of newAssessmentVersions) {
        const instrument = INSTRUMENTS.find((item) => item.version === version);
        const collection = {
          id: uid(),
          label: instrument.name,
          due: assessmentDue,
          version,
          assignment: "Planned",
          response: "Not started",
          review: "Pending",
          link: "Not sent",
          appointmentId: appointment.id,
          attempts: [],
          answers: [],
          respondent: "Person",
          recorder: "Person",
          assistance: "Independent",
        };
        e.collections.push(collection);
        event("Follow-up planned", `${collection.label} · due ${formatDate(assessmentDue)} · linked to contact`, {
          collectionId: collection.id,
          appointmentId: appointment.id,
        });
      }
      break;
    }
    case "RECORD_APPOINTMENT_OUTCOME": {
      const appointment = e?.appointments?.find(
        (item) => item.id === action.appointmentId,
      );
      if (appointmentOutcomeError(e, appointment, action, TODAY)) return state;
      Object.assign(appointment, appointmentOutcomeContent(action, appointment), {
        outcomeRecordedAt: recordedAt,
        outcomeRecordedBy: staff?.name || "Not recorded",
        outcomeRecordedById: staff?.id || null,
      });
      break;
    }
    case "UPDATE_APPOINTMENT": {
      const appointment = e?.appointments?.find(
        (item) => item.id === action.appointmentId,
      );
      if (!appointment) return state;
      if (action.plannedDate) appointment.plannedDate = action.plannedDate;
      if (action.plannedTime) appointment.plannedTime = action.plannedTime;
      if (action.plannedDurationMinutes)
        appointment.plannedDurationMinutes =
          Number(action.plannedDurationMinutes) || 60;
      if (action.practitionerService)
        appointment.practitionerService = action.practitionerService;
      if (action.deliveryMode) appointment.deliveryMode = action.deliveryMode;
      if (action.notes !== undefined) appointment.notes = action.notes;
      break;
    }
    case "DELETE_APPOINTMENT": {
      if (!e?.appointments) return state;
      const index = e.appointments.findIndex(
        (item) => item.id === action.appointmentId,
      );
      if (index !== -1) {
        e.appointments.splice(index, 1);
        for (const col of e.collections || []) {
          if (col.appointmentId === action.appointmentId) {
            col.appointmentId = null;
          }
          if (col.submittedAppointmentId === action.appointmentId) {
            col.submittedAppointmentId = null;
          }
          for (const attempt of col.attempts || []) {
            if (attempt.appointmentId === action.appointmentId) {
              attempt.appointmentId = null;
            }
          }
        }
      }
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
      if (e?.status !== "Active" || clinicalRecordError(e, action, TODAY) ||
          (action.externalAppointment &&
            (!validExternalSlot(action.externalAppointment) || action.externalAppointment.date < TODAY)))
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
      const changes = (nextPath.answers || []).flatMap((value, index) =>
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
      syncMeasureSampleRecord(e, c, staff.name);
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
      if (e.status === "Completed" && c.closureKind === "assessment" && c.needsReview) {
        e.status = "Closed";
        e.completedAt = null;
        event("Care episode completion pending", "Closure assessment answers changed; clinical re-review is required.", {
          actionType: "REOPEN_CLOSURE_REVIEW", collectionId: c.id,
        });
      }
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
        action.due < TODAY ||
        (action.externalAppointment &&
          (!validExternalSlot(action.externalAppointment) ||
            action.externalAppointment.date < TODAY ||
            action.externalAppointment.date > action.due)) ||
        (action.appointmentId && !e.appointments?.some((appointment) =>
          appointment.id === action.appointmentId &&
          appointmentMatchesCollectionDate(appointment, { due: action.due })))
      )
        return state;
      const plannedCollectionId = action.id || uid();
      e.collections.push({
        id: plannedCollectionId,
        label: action.label.trim(),
        due: action.due,
        version: action.version ?? VERSION,
        assignment: "Planned",
        response: "Not started",
        review: "Pending",
        link: "Not sent",
        channel: action.channel || undefined,
        appointmentId: action.appointmentId || null,
        externalAppointment: action.externalAppointment || null,
        attempts: [],
        answers: [],
        respondent: action.respondent || "Person",
        recorder: action.recorder || "Person",
        assistance: action.assistance || "Independent",
      });
      event(
        "Follow-up planned",
        `${action.label} · due ${formatDate(action.due)} · same care episode`,
        { collectionId: plannedCollectionId, appointmentId: action.appointmentId || null },
      );
      break;
    case "SAVE_COLLECTION_SETUP":
      if (
        !canAssess(p, e) || !c || !c.due || !canCollectInEpisode(e, c) ||
        p.consent !== "Recorded" || p.contact !== "Suitable" ||
        !getInstrument(c.version) || c.response === "Submitted" ||
        ["Paused", "Cancelled"].includes(c.assignment) ||
        !["SMS link", "Clinic tablet", "Clinician entry"].includes(action.channel) ||
        !getInstrument(c.version).respondents.includes(action.respondent) ||
        !(action.channel === "Clinician entry"
          ? ["Transcribed", "Joint completion"]
          : ["Independent", "Supported"]).includes(action.assistance) ||
        (action.respondent === "Family respondent" && !p.family) ||
        (action.channel === "Clinician entry" && currentStaff(state)?.role !== "Clinician") ||
        (action.externalAppointment &&
          (!validExternalSlot(action.externalAppointment) ||
            action.externalAppointment.date < TODAY ||
            action.externalAppointment.date > c.due))
      ) return state;
      c.channel = action.channel;
      c.respondent = action.respondent;
      c.respondentName = action.respondent === "Person" ? p.name : p.family;
      c.assistance = action.assistance;
      c.externalAppointment = action.channel === "SMS link"
        ? null : action.externalAppointment || null;
      c.setupSavedAt = recordedAt;
      event("Collection setup saved", `${c.label} · ${c.channel}`, { collectionId: c.id });
      break;
    case "DELIVER":
      if (
        !canAssess(p, e) ||
        !c ||
        !c.due ||
        !canCollectInEpisode(e, c) ||
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
      if (action.externalAppointment &&
          (!validExternalSlot(action.externalAppointment) ||
            action.externalAppointment.date < TODAY ||
            action.externalAppointment.date > c.due))
        return state;
      const hasExternalSelection = Object.hasOwn(action, "externalAppointment");
      c.assignment = "Active";
      c.link = "Active";
      c.respondent = action.respondent;
      c.respondentName = action.respondent === "Person" ? p.name : p.family;
      c.channel = action.channel;
      if (hasExternalSelection)
        c.externalAppointment = action.channel === "SMS link"
          ? null
          : action.externalAppointment || null;
      c.assistance = action.assistance;
      c.recorder =
        action.channel === "Clinician entry"
          ? currentStaff(state)?.name || "Staff member"
          : action.respondent;
      c.recorderName =
        action.channel === "Clinician entry" ? c.recorder : c.respondentName;
      c.recorderId =
        action.channel === "Clinician entry" ? currentStaff(state).id : null;
      const linkedApptId = hasExternalSelection || c.externalAppointment ? null :
        action.appointmentId ||
        (action.channel !== "SMS link"
          ? e.appointments?.find(
              (a) =>
                a.id === c.appointmentId &&
                !["Cancelled", "Did not attend"].includes(a.attendance),
            )?.id || e.appointments?.find(
              (a) =>
                (a.plannedDate === TODAY || a.actualDate === TODAY) &&
                !["Cancelled", "Did not attend"].includes(a.attendance),
            )?.id ||
            e.appointments?.find(
              (a) =>
                (a.plannedDate === c.due || a.actualDate === c.due) &&
                !["Cancelled", "Did not attend"].includes(a.attendance),
            )?.id
          : null) ||
        null;
      c.appointmentId = linkedApptId;
      c.attempts.push({
        id: uid(),
        date: TODAY,
        channel: action.channel,
        respondent: c.respondent,
        respondentName: c.respondentName,
        recorderName: c.recorderName,
        recorderId: c.recorderId,
        assistance: c.assistance,
        appointmentId: linkedApptId,
        externalAppointment: c.externalAppointment,
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
        { attemptId: c.attempts.at(-1).id, appointmentId: linkedApptId },
      );
      break;
    case "SUBMIT":
      if (
        !canAssess(p, e) ||
        !c ||
        !canCollectInEpisode(e, c) ||
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
      const questionnaireAppointmentId =
        c.appointmentId || c.attempts.at(-1)?.appointmentId;
      const appointmentOutcome = action.appointmentOutcome;
      const confirmedChannel = action.completionMethod || appointmentOutcome?.completionMethod || c.channel;
      const appointmentToConfirm = appointmentOutcome
        ? e.appointments?.find((item) => item.id === questionnaireAppointmentId)
        : null;
      if (
        action.completionMethod &&
        (![
          "Clinician entry",
          "Clinic tablet",
        ].includes(c.channel) ||
          !["Clinician entry", "Clinic tablet"].includes(confirmedChannel) ||
          (confirmedChannel === "Clinician entry" && staff?.role !== "Clinician") ||
          !c.attempts.at(-1))
      )
        return state;
      if (appointmentOutcome) {
        if (
          !["Clinician entry", "Clinic tablet"].includes(c.channel) ||
          !["Clinician entry", "Clinic tablet"].includes(confirmedChannel) ||
          (confirmedChannel === "Clinician entry" && staff?.role !== "Clinician") ||
          !c.attempts.at(-1) ||
          !appointmentToConfirm ||
          appointmentOutcome.appointmentId !== questionnaireAppointmentId ||
          appointmentToConfirm.attendance !== "Planned" ||
          (appointmentOutcome.attendance !== "Planned" &&
            appointmentOutcomeError(e, appointmentToConfirm, appointmentOutcome, TODAY))
        )
          return state;
      }
      c.answers = questionnaireState(
        getInstrument(c.version),
        action.answers,
      ).answers;
      c.response = "Submitted";
      c.assessmentProgress = "Completed";
      c.assignment = "Fulfilled";
      c.link = "Ended";
      c.submittedAt = TODAY;
      c.submittedTimestamp = recordedAt;
      c.submittedAttemptId = c.attempts.at(-1)?.id;
      c.submittedAppointmentId = c.appointmentId || c.attempts.at(-1)?.appointmentId || null;
      syncMeasureSampleRecord(e, c, staff?.name || "Not recorded");
      if (appointmentOutcome || action.completionMethod) {
        const attempt = c.attempts.at(-1);
        if (confirmedChannel !== c.channel) {
          attempt.startedChannel = attempt.channel;
          c.channel = confirmedChannel;
          c.assistance = confirmedChannel === "Clinician entry" ? "Transcribed" : "Independent";
          c.recorder = confirmedChannel === "Clinician entry" ? staff.name : c.respondent;
          c.recorderName = confirmedChannel === "Clinician entry" ? staff.name : c.respondentName;
          c.recorderId = confirmedChannel === "Clinician entry" ? staff.id : null;
          Object.assign(attempt, {
            channel: confirmedChannel,
            assistance: c.assistance,
            recorderName: c.recorderName,
            recorderId: c.recorderId,
          });
        }
        attempt.methodConfirmedAt = recordedAt;
        attempt.methodConfirmedBy = staff?.name || "Not recorded";
      }
      if (appointmentOutcome?.attendance !== "Planned" && appointmentToConfirm) {
        Object.assign(
          appointmentToConfirm,
          appointmentOutcomeContent(appointmentOutcome, appointmentToConfirm),
          {
            outcomeRecordedAt: recordedAt,
            outcomeRecordedBy: staff?.name || "Not recorded",
            outcomeRecordedById: staff?.id || null,
          },
        );
      }
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
      completeClosureFollowUp();
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
      completeClosureFollowUp();
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
          ...(p.episodes || []).flatMap((episode) =>
            careChanges(
              (priorPerson?.episodes || []).find((prior) => prior.id === episode.id),
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
      if (action.status === "Closed" && currentCarePeriod(e) &&
          action.end < currentCarePeriod(e).startDate)
        return state;
      e.status = action.status;
      if (action.status === "Closed") {
        e.end = action.end;
        if (currentCarePeriod(e))
          currentCarePeriod(e).endDateExclusive = nextDate(action.end);
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
            detail: `Care episode closed; referral remains open. ${referral.nextAction}`,
            occurredAt: null,
            system: "YSCC care-episode closure",
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
      if (action.status === "Closed") {
        const assignments = closureCollections(p, e);
        e.collections.push(...assignments);
        for (const assignment of assignments) {
          event(
            "Closure questionnaire assigned",
            `${assignment.label} · ${p.name} · due ${formatDate(assignment.due)} · ${assignment.link === "Active" ? "sample link prepared, not sent" : "contact settings need review before link preparation"}`,
            { collectionId: assignment.id },
          );
        }
      }
      event(
        `Care episode ${action.status.toLowerCase()}`,
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
          ...(p.episodes || []).flatMap((episode) =>
            careChanges(
              (priorPerson?.episodes || []).find((prior) => prior.id === episode.id),
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
  if (response.readOnly)
    return "This historical assessment is view only.";
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
