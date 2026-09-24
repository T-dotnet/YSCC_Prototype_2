import { careChanges, recordFieldChanges } from "./activity.js";
import { PROGRAM_STREAMS } from "./carePeriods.js";

// Prototype workflow only: clinical criteria and external agreements remain D-26/D-27.
export const INTAKE_STATES = [
  "Received",
  "In progress",
  "Awaiting information",
  "Awaiting triage",
  "Waiting",
  "Completed",
  "Closed incomplete",
];
export const INTAKE_CHECKS = [
  ["identityChecked", "Identity and matching reviewed"],
  ["permissionChecked", "Applicable permissions and authority reviewed"],
  ["supportChecked", "Contact and support arrangements reviewed"],
  ["triageChecked", "Required intake and triage checks resolved"],
];
export const INTAKE_DETAIL_FIELDS = [
  "legalName", "sourceIdentifiers", "receivedAt", "source", "sourceReference", "reason",
  "contactMethod", "contactValue", "contactHolder", "safeContact", "permissionReference",
  "language", "supportNeeds", "supporter", "authority", "nextAction", "reviewDate",
  "waitingReason", "waitingOn", "communication",
];
export function intakeCheckFieldsError(values) {
  const unchecked = INTAKE_CHECKS.find(([key]) => values?.[key] !== true);
  if (unchecked) return `Confirm ${unchecked[1].toLowerCase()} before saving intake.`;
  if (typeof values?.reviewer !== "string" || !values.reviewer.trim())
    return "Assign a triage reviewer before saving intake.";
  if (typeof values?.nextAction !== "string" || !values.nextAction.trim())
    return "Enter the next step before saving intake.";
  return "";
}
export function intakeStepComplete(intake) {
  if (!intake) return false;
  if (["Completed", "Closed incomplete"].includes(intake.status)) return true;
  if (intakeCheckFieldsError(intake)) return false;
  if ("checksValidatedAt" in intake) return validTime(intake.checksValidatedAt);
  return intake.history?.some(
    (event) => event.detail === "Required intake check fields validated and saved.",
  ) === true;
}
export const REFERRAL_EVENTS = [
  "Sending attempt",
  "Verify sending outcome",
  "Receipt acknowledged",
  "Awaiting information",
  "Accepted",
  "Declined",
  "Follow-up",
  "Handover confirmed",
  "Alternative plan",
  "Cancelled with plan",
];
const text = (value) => typeof value === "string" && !!value.trim();
export const validDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value || "") &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
const validTime = (value) => text(value) && Number.isFinite(Date.parse(value));
export const intakeFor = (person, episode) =>
  episode
    ? person?.intakes?.find((i) => i.episodeId === episode.id) ||
      person?.intakes?.find((i) => i.id === episode.intakeId)
    : person?.intakes?.[0];
export const intakeReady = (i) =>
  !!i &&
  i.status === "Completed" &&
  i.outcome === "Proceed" &&
  i.consentRecorded === true &&
  INTAKE_CHECKS.every(([key]) => i[key] === true) &&
  text(i.decisionBy) &&
  validTime(i.decisionAt) &&
  text(i.assessmentOwner);
export const intakeStage = (i) => {
  if (!i || i.status === "Received") return "Registration";
  if (intakeReady(i)) return "Assessment";
  return "Intake & triage";
};
export const canAssess = (person, episode) =>
  !!episode && intakeReady(intakeFor(person, episode));
export const referralOpen = (r) =>
  ![
    "Resolved handover",
    "Resolved alternative",
    "Cancelled with plan",
  ].includes(r.handover);

function initialAssessmentCollection(intake, person, version, uid) {
  const respondentName = intake.respondentPreference === "Family respondent"
    ? intake.respondentName : person.name;
  return {
    id: uid(),
    label: "Initial assessment",
    due: "",
    version,
    assignment: "Planned",
    response: "Not started",
    review: "Pending",
    link: "Not sent",
    attempts: [],
    answers: [],
    respondent: intake.respondentPreference || "Person",
    respondentName,
    recorder: intake.respondentPreference || "Person",
    recorderName: respondentName,
    assistance: "Independent",
  };
}

export function newIntake({
  id,
  owner,
  today,
  actor,
  timestamp,
  episodeId = null,
}) {
  return {
    id,
    owner,
    service: "Northside Centre",
    episodeId,
    status: "Received",
    outcome: "",
    revision: 0,
    receivedAt: "",
    createdAt: timestamp,
    createdBy: actor,
    source: "Unknown",
    sourceReference: "",
    reason: "",
    contactMethod: "Not yet discussed",
    contactValue: "",
    contactHolder: "",
    safeContact: "",
    permissionReference: "",
    language: "",
    supportNeeds: "",
    supporter: "",
    authority: "Not yet reviewed",
    consentRecorded: false,
    consentReference: "",
    respondentPreference: "Person",
    respondentName: "",
    legalName: "",
    sourceIdentifiers: "",
    identityChecked: false,
    permissionChecked: false,
    supportChecked: false,
    triageChecked: false,
    checkEvidence: "",
    checksValidatedAt: "",
    reviewer: owner,
    summary: "",
    assessmentOwner: "",
    nextAction: "Complete intake and resolve required checks",
    reviewDate: today,
    waitingReason: "",
    waitingOn: "",
    communication: "",
    history: [
      {
        id: `${id}-created`,
        timestamp,
        actor,
        title: "Intake received",
        detail:
          "Registration recorded; assessment requires completed intake and a proceed decision.",
      },
    ],
  };
}

export function intakeActionError(state, action, staff) {
  const p = state.people.find((p) => p.id === action.personId);
  const i = p?.intakes?.find((i) => i.id === action.intakeId);
  if (!staff) return "Choose a staff profile first.";
  if (action.type === "ADD_PERSON") {
    if (
      !text(action.requestId) ||
      !text(action.owner) ||
      !text(action.nextAction) ||
      !validDate(action.reviewDate)
    )
      return "Record an intake owner, next action and review date.";
    if (!text(action.name) && action.nameUnknown !== true)
      return "Enter the supplied name or mark it as unknown.";
    if (action.dob && (!validDate(action.dob) || action.dob > "2026-09-15"))
      return "Check the supplied date of birth.";
    if (state.people.some((p) => p.registrationRequestId === action.requestId))
      return "This registration is already saved. Open the existing record.";
    if (
      text(action.name) &&
      state.people.some(
        (p) =>
          !p.nameUnknown &&
          p.name.trim().toLowerCase() === action.name.trim().toLowerCase(),
      )
    )
      return "A matching name exists. Review that record before creating another person.";
    return "";
  }
  if (!p) return "The person record is unavailable.";
  if (action.type === "UPDATE_INTAKE_DETAILS") {
    if (!i || p.archivedAt) return "Restore the person and reopen this intake record before editing.";
    if (action.revision !== i.revision) return "This intake changed. Reopen it before saving.";
    if (!text(action.reason)) return "Record a reason for this update.";
    const values = action.values || {};
    if (!text(values.name)) return "Enter the supplied name.";
    if (state.people.some((other) => other.id !== p.id &&
        !other.nameUnknown && other.name.trim().toLowerCase() === values.name.trim().toLowerCase()))
      return "A matching name exists. Review that record before saving.";
    if (values.dob && (!validDate(values.dob) || values.dob > "2026-09-15"))
      return "Check the supplied date of birth.";
    if (values.receivedAt && !validTime(values.receivedAt))
      return "Check the received date and time.";
    if (!validDate(values.reviewDate)) return "Enter a valid next review date.";
    if (!text(values.nextAction)) return "Enter the next action.";
    return "";
  }
  if (
    ["SAVE_INTAKE", "START_ASSESSMENT", "REOPEN_INTAKE"].includes(
      action.type,
    )
  ) {
    if (!i) return "The intake record is unavailable.";
    if (action.revision !== i.revision)
      return "This intake changed. Reopen it before saving.";
    if (action.type === "REOPEN_INTAKE") {
      if (i.status !== "Completed")
        return "Only a completed intake can be reopened.";
      if (p.episodes.some((episode) => episode.id !== i.episodeId || episode.programStream || episode.collections?.[0]?.due))
        return "Assessment planning has already started. The completed intake is retained in history.";
      return "";
    }
    if (action.type === "START_ASSESSMENT") {
      if (!PROGRAM_STREAMS.includes(action.programStream))
        return "Choose the program stream for this episode.";
      if (!intakeReady(i))
        return "Complete intake with a proceed decision and assessment owner first.";
      if (p.episodes.some((episode) => episode.id !== i.episodeId) ||
          (i.episodeId && p.episodes.find((episode) => episode.id === i.episodeId)?.collections?.[0]?.due))
        return "An existing care record needs review; another episode cannot be created here.";
      if (!validDate(action.due) || action.due < "2026-09-15")
        return "Choose an assessment due date on or after the sample date.";
      return "";
    }
    const f = action.values || {};
    if (f.dob && (!validDate(f.dob) || f.dob > "2026-09-15"))
      return "Check the supplied date of birth.";
    if (
      text(f.displayName) &&
      state.people.some(
        (other) =>
          other.id !== p.id &&
          !other.nameUnknown &&
          other.name.trim().toLowerCase() ===
            f.displayName.trim().toLowerCase(),
      )
    )
      return "A matching name exists. Resolve the identity match before saving.";
    if (["Completed", "Closed incomplete"].includes(i.status))
      return "This intake is finalised. Its decision and history are retained.";
    if (action.validatedChecks === true) {
      const problem = intakeCheckFieldsError(f);
      if (problem) return problem;
    }
    if (!INTAKE_STATES.includes(f.status)) return "Choose an intake state.";
    if (
      !text(f.owner) ||
      !text(f.nextAction) ||
      !validDate(f.reviewDate) ||
      !text(f.changeReason)
    )
      return "Record an owner, next action, review date and reason for this update.";
    if (f.receivedAt && !validTime(f.receivedAt))
      return "Check the received date and time, or leave it unknown.";
    if (
      ["Awaiting information", "Awaiting triage", "Waiting"].includes(
        f.status,
      ) &&
      (!text(f.waitingReason) || !text(f.waitingOn))
    )
      return "Record why intake is waiting and who owns the outstanding step.";
    if (f.status === "Completed") {
      if (staff.role !== "Clinician")
        return "The demo Clinician profile records intake decisions.";
      if (f.consentRecorded !== true || !text(f.consentReference))
        return "Record consent and its source in the intake form before completing intake.";
      if (
        !["Person", "Family respondent"].includes(f.respondentPreference) ||
        (f.respondentPreference === "Family respondent" &&
          !text(f.respondentName))
      )
        return "Record the initial assessment respondent in the intake form before completing intake.";
      if (!INTAKE_CHECKS.every(([key]) => f[key] === true))
        return "Resolve the required intake checks before recording an outcome.";
      if (
        !["Proceed", "Do not proceed"].includes(f.outcome) ||
        !validTime(f.decisionAt)
      )
        return "The intake outcome needs a valid recorded decision time. Retry the action.";
      if (f.outcome === "Proceed" && !text(f.assessmentOwner))
        return "Assign an intake owner before proceeding to assessment.";
    }
    return "";
  }
  if (action.type === "ADD_REFERRAL") {
    const f = action.values || {};
    if (
      !text(action.requestId) ||
      p.referrals?.some((r) => r.requestId === action.requestId)
    )
      return "This referral is already saved. Open the existing referral.";
    if (
      !text(f.destination) ||
      !text(f.purpose) ||
      !text(f.owner) ||
      !text(f.nextAction) ||
      !validDate(f.reviewDate)
    )
      return "Record the destination, purpose, YSCC owner, next action and follow-up date.";
    if (action.episodeId && !p.episodes.some((e) => e.id === action.episodeId))
      return "The selected care record is unavailable.";
    return "";
  }
  if (action.type === "REFERRAL_EVENT") {
    const r = p.referrals?.find((r) => r.id === action.referralId),
      f = action.values || {};
    if (!r || !referralOpen(r))
      return "This referral is unavailable or already resolved.";
    if (action.revision !== r.revision)
      return "This referral changed. Reopen it before saving.";
    if (
      !REFERRAL_EVENTS.includes(f.kind) ||
      !validTime(f.occurredAt) ||
      !text(f.system) ||
      !text(f.evidence)
    )
      return "Record the event, actual event time, service/system and evidence reference.";
    if (!text(f.nextAction) || !validDate(f.reviewDate))
      return "Keep a next action and follow-up date for this referral.";
    if (["Sending attempt", "Verify sending outcome"].includes(f.kind)) {
      if (!text(f.permissionReference) || !text(f.permittedInformation))
        return "Record sharing permission and the permitted information before sending.";
      if (!["Sent", "Failed", "Outcome unknown"].includes(f.result))
        return "Record the observed sending outcome.";
      if (f.kind === "Sending attempt" && r.transmission === "Outcome unknown")
        return "Verify the unknown sending outcome before retrying.";
      if (
        f.kind === "Verify sending outcome" &&
        (r.transmission !== "Outcome unknown" || f.result === "Outcome unknown")
      )
        return "Verify the existing unknown attempt as sent or failed.";
    }
    if (
      f.kind === "Handover confirmed" &&
      (r.decision !== "Accepted" ||
        r.receipt !== "Acknowledged received" ||
        !text(f.externalOwner) ||
        f.receivingResponsibility !== "Confirmed")
    )
      return "Record receipt, acceptance, the receiving owner and their confirmed responsibility before confirming handover.";
    if (!text(f.owner)) return "Assign the YSCC follow-up owner.";
    if (
      [
        "Handover confirmed",
        "Alternative plan",
        "Cancelled with plan",
      ].includes(f.kind) &&
      !text(f.plan)
    )
      return "Record the agreed next-care arrangement or alternative plan.";
    return "";
  }
  return "Unknown intake action.";
}

export function applyIntakeAction(
  state,
  action,
  { staff, uid, today, version },
) {
  if (intakeActionError(state, action, staff)) return state;
  const next = JSON.parse(JSON.stringify(state)),
    timestamp = new Date().toISOString();
  const p = next.people.find((p) => p.id === action.personId);
  const i = p?.intakes?.find((i) => i.id === action.intakeId);
  const history = (title, detail) => ({
    id: uid(),
    title,
    detail,
    actor: staff.name,
    actorId: staff.id,
    role: staff.role,
    timestamp,
  });
  if (action.type === "ADD_PERSON") {
    const id = `YS-${Math.max(1023, ...next.people.map((p) => Number(p.id.slice(3))).filter(Number.isFinite)) + 1}`;
    const intake = newIntake({
      id: uid(),
      owner: action.owner.trim(),
      today,
      actor: staff.name,
      timestamp,
    });
    intake.nextAction = action.nextAction.trim();
    intake.reviewDate = action.reviewDate;
    intake.history[0].snapshot = {
      displayName: action.name?.trim() || "Unknown",
      dob: action.dob || "Unknown",
    };
    intake.history[0].actorId = staff.id;
    intake.history[0].role = staff.role;
    next.people.push({
      id,
      registrationRequestId: action.requestId,
      name: action.name?.trim() || "Name not yet known",
      nameUnknown: !text(action.name),
      dob: action.dob || null,
      pronouns: action.pronouns || "Not recorded",
      owner: intake.owner,
      consent: "Not recorded",
      contact: "Not confirmed",
      family: null,
      episodes: [],
      intakes: [intake],
      referrals: [],
    });
  } else if (action.type === "UPDATE_INTAKE_DETAILS") {
    const f = action.values;
    const previous = JSON.parse(JSON.stringify(i));
    const priorPerson = { name: p.name, dob: p.dob, pronouns: p.pronouns };
    p.name = f.name.trim();
    p.nameUnknown = false;
    p.dob = f.dob || null;
    p.pronouns = f.pronouns || "Not recorded";
    for (const key of INTAKE_DETAIL_FIELDS) {
      if (f[key] !== undefined)
        i[key] = typeof f[key] === "string" ? f[key].trim() : f[key];
    }
    const changes = [
      ...recordFieldChanges(priorPerson, p, [["name", "Name"], ["dob", "Date of birth"], ["pronouns", "Pronouns"]]),
      ...recordFieldChanges(previous, i, INTAKE_DETAIL_FIELDS.map((key) => [key, key.replace(/([A-Z])/g, " $1")])),
    ];
    if (!changes.length) return state;
    i.revision += 1;
    i.history.unshift({
      ...history("Intake information updated", action.reason.trim()),
      changes,
      snapshot: Object.fromEntries(["name", "dob", "pronouns", ...INTAKE_DETAIL_FIELDS].map((key) => [key, key in f ? f[key] : i[key]])),
    });
  } else if (action.type === "REOPEN_INTAKE") {
    const previous = JSON.parse(JSON.stringify(i));
    i.status = "In progress";
    i.outcome = "";
    i.decisionAt = "";
    i.decisionBy = "";
    if (i.episodeId) {
      p.episodes = p.episodes.filter((episode) => episode.id !== i.episodeId);
      i.episodeId = null;
    }
    i.revision += 1;
    i.history.unshift({
      ...history(
        "Intake reopened",
        "Completed intake reopened for update before assessment planning.",
      ),
      changes: recordFieldChanges(previous, i, [
        ["status", "Status"],
        ["outcome", "Outcome"],
        ["decisionAt", "Decision time"],
        ["decisionBy", "Decision recorded by"],
      ]),
    });
  } else if (action.type === "SAVE_INTAKE") {
    const f = action.values;
    const previous = JSON.parse(JSON.stringify(i));
    const priorIdentity = { name: p.name, dob: p.dob || "Unknown" };
    // Whitelist editable form fields: IDs, actor and history cannot be overwritten.
    const fields = [
      "status",
      "owner",
      "receivedAt",
      "source",
      "sourceReference",
      "reason",
      "contactMethod",
      "contactValue",
      "contactHolder",
      "safeContact",
      "permissionReference",
      "language",
      "supportNeeds",
      "supporter",
      "authority",
      "consentRecorded",
      "consentReference",
      "respondentPreference",
      "respondentName",
      "legalName",
      "sourceIdentifiers",
      "checkEvidence",
      "reviewer",
      "summary",
      "assessmentOwner",
      "nextAction",
      "reviewDate",
      "waitingReason",
      "waitingOn",
      "communication",
      ...INTAKE_CHECKS.map(([k]) => k),
    ];
    for (const key of fields)
      if (f[key] !== undefined)
        i[key] = typeof f[key] === "string" ? f[key].trim() : f[key];
    if (action.validatedChecks === true) {
      i.checksValidatedAt = timestamp;
    } else if (
      INTAKE_CHECKS.some(([key]) => i[key] !== previous[key]) ||
      i.reviewer !== previous.reviewer
    ) {
      i.checksValidatedAt = "";
    }
    if (f.displayName !== undefined) {
      p.name = f.displayName.trim() || "Name not yet known";
      p.nameUnknown = !text(f.displayName);
    }
    if (f.dob !== undefined) p.dob = f.dob || null;
    if (f.consentRecorded !== undefined)
      p.consent = f.consentRecorded ? "Recorded" : "Not recorded";
    if (
      f.respondentPreference === "Family respondent" &&
      text(f.respondentName)
    )
      p.family = f.respondentName.trim();
    i.revision += 1;
    if (i.status === "Completed") {
      i.outcome = f.outcome;
      i.decisionAt = f.decisionAt;
      i.decisionBy = staff.name;
      const hadEpisodeBeforeCompletion = !!i.episodeId;
      if (i.outcome === "Proceed" && !i.episodeId && !p.episodes.length) {
        const episodeId = uid();
        i.episodeId = episodeId;
        p.owner = i.assessmentOwner;
        p.episodes.push({
          id: episodeId,
          intakeId: i.id,
          number: "01",
          status: "Active",
          start: i.decisionAt.slice(0, 10),
          programStream: "",
          disposition: "Undecided",
          owner: i.assessmentOwner,
          events: [{
            id: uid(),
            date: i.decisionAt.slice(0, 10),
            timestamp,
            actor: "System",
            actorId: "system",
            role: "System",
            title: "Initial assessment added after intake",
            detail: "Instrument added automatically after the proceed decision; due date and program stream need planning.",
          }],
          collections: [initialAssessmentCollection(i, p, version, uid)],
        });
      }
      if (i.outcome === "Proceed" && hadEpisodeBeforeCompletion) {
        const ep = p.episodes?.find((e) => e.id === i.episodeId);
        if (ep && !ep.events?.some((evt) => evt.eventType === "inpatient")) {
          ep.events ??= [];
          ep.events.unshift({
            id: uid(),
            date: i.decisionAt ? i.decisionAt.slice(0, 10) : today,
            eventDate: i.decisionAt ? i.decisionAt.slice(0, 10) : today,
            timestamp,
            actor: "System",
            actorId: "system",
            role: "System",
            actionType: "ADD_CARE_EVENT",
            eventType: "inpatient",
            title: "Inpatient admission recorded",
            detail: `Inpatient admission automatically recorded upon successful intake completion (${i.service || "Northside Centre"}).`,
            fields: {
              source: `${i.service || "Northside Centre"} intake`,
              notes: "Automatic system record created upon successful intake completion with proceed decision.",
            },
            personId: p.id,
            episodeId: ep.id,
          });
        }
      }
    }
    i.history.unshift({
      ...history(`Intake ${i.status.toLowerCase()}`, f.changeReason.trim()),
      priorIdentity,
      changes: [
        ...recordFieldChanges(previous, i, [...fields, "outcome", "decisionAt"].map((key) => [key, key.replace(/([A-Z])/g, " $1")])),
        ...recordFieldChanges(priorIdentity, { name: p.name, dob: p.dob || "Unknown" }, [["name", "Name"], ["dob", "Date of birth"]]),
      ],
      snapshot: Object.fromEntries(
        [...fields, "displayName", "dob", "outcome", "decisionAt"]
          .filter((key) => f[key] !== undefined)
          .map((key) => [key, f[key]]),
      ),
    });
  } else if (action.type === "START_ASSESSMENT") {
    if (i.episodeId) {
      const episode = p.episodes.find((item) => item.id === i.episodeId);
      episode.programStream = action.programStream;
      episode.collections[0].due = action.due;
      i.revision += 1;
      episode.events.unshift({
        id: uid(), date: today, timestamp, actor: staff.name, actorId: staff.id,
        role: staff.role, actionType: action.type, title: "Assessment planned after intake",
        detail: `${i.assessmentOwner} owns the assessment · due ${action.due} · ${action.programStream} stream`,
      });
      episode.events.unshift({
        id: uid(), date: today, eventDate: today, timestamp,
        actor: "System", actorId: "system", role: "System",
        actionType: "ADD_CARE_EVENT", eventType: "inpatient",
        title: "Inpatient admission recorded",
        detail: `Inpatient admission automatically recorded upon successful intake completion (${i.service || "Northside Centre"}).`,
        fields: {
          source: `${i.service || "Northside Centre"} intake`,
          notes: "Automatic system record created upon successful intake completion and assessment planning.",
        },
        personId: p.id, episodeId: episode.id,
      });
      i.history.unshift(history("Assessment handoff recorded", `Initial assessment due ${action.due} · ${i.assessmentOwner}`));
      return next;
    }
    const episodeId = uid();
    i.episodeId = episodeId;
    i.revision += 1;
    p.owner = i.assessmentOwner;
    p.episodes.push({
      id: episodeId,
      number: "01",
      status: "Active",
      start: today,
      programStream: action.programStream,
      disposition: "Undecided",
      owner: i.assessmentOwner,
      events: [
        {
          id: uid(),
          date: today,
          timestamp,
          actor: staff.name,
          actorId: staff.id,
          role: staff.role,
          actionType: action.type,
          title: "Assessment planned after intake",
          detail: `${i.decisionBy} recorded proceed · ${i.assessmentOwner} owns the assessment · admission undecided`,
        },
        {
          id: uid(),
          date: today,
          eventDate: today,
          timestamp,
          actor: "System",
          actorId: "system",
          role: "System",
          actionType: "ADD_CARE_EVENT",
          eventType: "inpatient",
          title: "Inpatient admission recorded",
          detail: `Inpatient admission automatically recorded upon successful intake completion (${i.service || "Northside Centre"}).`,
          fields: {
            source: `${i.service || "Northside Centre"} intake`,
            notes: "Automatic system record created upon successful intake completion and assessment planning.",
          },
          personId: p.id,
          episodeId,
        },
      ],
      collections: [
        {
          ...initialAssessmentCollection(i, p, version, uid),
          due: action.due,
        },
      ],
    });
    const episode = p.episodes.at(-1);
    episode.events[0].changes = careChanges(null, episode);
    i.history.unshift(
      history(
        "Assessment handoff recorded",
        `Initial assessment due ${action.due} · ${i.assessmentOwner}`,
      ),
    );
  } else if (action.type === "ADD_REFERRAL") {
    const f = action.values;
    p.referrals ??= [];
    p.referrals.push({
      id: uid(),
      requestId: action.requestId,
      intakeId: action.intakeId || null,
      episodeId: action.episodeId || null,
      revision: 0,
      destination: f.destination.trim(),
      purpose: f.purpose.trim(),
      destinationContact: f.destinationContact?.trim() || "",
      owner: f.owner.trim(),
      permissionReference: f.permissionReference?.trim() || "",
      permittedInformation: f.permittedInformation?.trim() || "",
      nextAction: f.nextAction.trim(),
      reviewDate: f.reviewDate,
      preparation: "Draft",
      transmission: "Not sent",
      receipt: "Unconfirmed",
      decision: "Pending",
      handover: "Open",
      externalOwner: "",
      receivingResponsibility: "Not confirmed",
      handoverConfirmedAt: null,
      handoverEvidence: null,
      closureReconciliation: null,
      attempts: [],
      history: [
        history("Referral prepared", "Draft saved; no external message sent."),
      ],
    });
    const referral = p.referrals.at(-1);
    referral.history[0].changes = recordFieldChanges(null, referral, Object.keys(referral)
      .filter((key) => !["id", "requestId", "intakeId", "episodeId", "revision", "attempts", "history"].includes(key))
      .map((key) => [key, key.replace(/([A-Z])/g, " $1")]));
  } else {
    const r = p.referrals.find((r) => r.id === action.referralId),
      f = action.values;
    const previous = JSON.parse(JSON.stringify(r));
    const event = {
      ...history(f.kind, f.evidence.trim()),
      occurredAt: f.occurredAt,
      system: f.system.trim(),
      externalOwner: f.externalOwner?.trim() || "",
      result: f.result || null,
      plan: f.plan?.trim() || null,
      nextAction: f.nextAction.trim(),
      reviewDate: f.reviewDate,
    };
    if (["Sending attempt", "Verify sending outcome"].includes(f.kind)) {
      r.transmission = f.result;
      r.preparation = "Prepared";
      r.permissionReference = f.permissionReference.trim();
      r.permittedInformation = f.permittedInformation.trim();
      if (f.kind === "Sending attempt") r.attempts.push({ ...event });
      else event.attemptId = r.attempts.at(-1)?.id;
    }
    if (f.kind === "Receipt acknowledged") r.receipt = "Acknowledged received";
    if (["Awaiting information", "Accepted", "Declined"].includes(f.kind))
      r.decision = f.kind;
    if (f.kind === "Accepted")
      r.handover = "Awaiting acknowledgement of responsibility";
    if (f.kind === "Handover confirmed") {
      r.handover = "Resolved handover";
      r.receivingResponsibility = "Confirmed";
      r.handoverConfirmedAt = f.occurredAt;
      r.handoverEvidence = f.evidence.trim();
    }
    if (f.kind === "Alternative plan") r.handover = "Resolved alternative";
    if (f.kind === "Cancelled with plan") r.handover = "Cancelled with plan";
    if (text(f.externalOwner)) r.externalOwner = f.externalOwner.trim();
    r.owner = f.owner.trim();
    r.nextAction = f.nextAction.trim();
    r.reviewDate = f.reviewDate;
    r.revision += 1;
    event.changes = recordFieldChanges(previous, r, Object.keys(r)
      .filter((key) => !["id", "requestId", "intakeId", "episodeId", "revision", "attempts", "history"].includes(key))
      .map((key) => [key, key.replace(/([A-Z])/g, " $1")]));
    r.history.unshift(event);
  }
  return next;
}

export function intakeTasks(state, today) {
  return (state?.people || []).filter((p) => !p.archivedAt).flatMap((p) => [
    ...(p.intakes || [])
      .filter(
        (i) =>
          !["Completed", "Closed incomplete"].includes(i.status) ||
          (intakeReady(i) && !i.episodeId),
      )
      .map((i) => ({
        kind: "intake",
        person: p,
        record: i,
        owner: intakeReady(i) ? i.assessmentOwner : i.owner,
        status:
          i.reviewDate < today
            ? "Overdue"
            : intakeReady(i)
              ? "Waiting for assessment"
              : i.status,
        action: intakeReady(i) ? "Plan assessment" : "Continue intake",
      })),
    ...(p.referrals || []).filter(referralOpen).map((r) => ({
      kind: "referral",
      person: p,
      record: r,
      owner: r.owner,
      status:
        r.reviewDate < today
          ? "Overdue"
          : r.transmission === "Failed"
            ? "Sending failed"
            : r.decision === "Declined"
              ? "Declined"
              : "Follow-up open",
      action: "Follow up referral",
    })),
  ]);
}
