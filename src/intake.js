import { careChanges, recordFieldChanges } from "./activity.js";
import { PROGRAM_STREAMS, UNIDENTIFIED_EPISODE_STREAM } from "./carePeriods.js";
import { validExternalSlot } from "./externalAppointmentSlots.js";
import { PROFILE_FIELDS } from "./batch1Registration.js";

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
  "source", "referralDate", "commencementDate", "commencementDateUhr", "commencementDateFep",
  ...PROFILE_FIELDS,
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
export const intakeReady = (i) => !!i && i.status !== "Received";
export const intakeStage = (i) => {
  if (!i || i.status === "Received") return "Registration";
  if (intakeReady(i)) return "Assessment";
  return "Registration";
};
export const canAssess = (person, episode) =>
  !!episode && (person?.mvpProfile === true || intakeReady(intakeFor(person, episode)));
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
    referralDate: "",
    sourceReference: "",
    commencementDate: "",
    programStream: "",
    commencementDateUhr: "",
    commencementDateFep: "",
    clientPostcode: "",
    clientGender: "",
    clientSexuality: "",
    clientAtsiStatus: "",
    clientCountryOfBirth: "",
    clientLanguageHome: "",
    clientEthnicity: "",
    clientEducationLevel: "",
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
    nextAction: "Complete registration",
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
          "Profile created; complete registration before planning assessment.",
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
    if (!text(action.name)) return "Enter the young person’s name.";
    if ((!action.mvpProfile || action.dob) &&
        (!validDate(action.dob) || action.dob > new Date().toISOString().slice(0, 10)))
      return "Enter a valid date of birth.";
    if (action.mvpProfile && ![...PROGRAM_STREAMS, UNIDENTIFIED_EPISODE_STREAM].includes(action.programStream))
      return "Choose an episode stream.";
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
    if (values.dob && (!validDate(values.dob) || values.dob > new Date().toISOString().slice(0, 10)))
      return "Check the supplied date of birth.";
    for (const key of ["referralDate", "commencementDate", "commencementDateUhr", "commencementDateFep"]) {
      if (values[key] && !validDate(values[key])) return `Check the ${key.replace(/([A-Z])/g, " $1").toLowerCase()}.`;
    }
    if (values.clientPostcode && !/^\d{4}$/.test(values.clientPostcode))
      return "Enter a four-digit young person postcode or leave it blank.";
    if (values.commencementDate && [values.commencementDateUhr, values.commencementDateFep].some((date) => date && date < values.commencementDate))
      return "Stream commencement dates must be on or after the episode commencement date.";
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
      if (!i || i.status === "Received") return "Save registration fields before planning assessment.";
      if (p.episodes.some((episode) => episode.id !== i.episodeId) ||
          (i.episodeId && p.episodes.find((episode) => episode.id === i.episodeId)?.collections?.[0]?.due))
        return "An existing care record needs review; another episode cannot be created here.";
      if (!validDate(action.due) || action.due < "2026-09-15")
        return "Choose an assessment due date on or after the sample date.";
      if (action.externalAppointment &&
          (!validExternalSlot(action.externalAppointment) ||
            action.externalAppointment.date < "2026-09-15" ||
            action.externalAppointment.date > action.due))
        return "Choose an available contact on or before the assessment due date.";
      return "";
    }
    const f = action.values || {};
    for (const key of ["referralDate", "commencementDate", "commencementDateUhr", "commencementDateFep"]) {
      if (f[key] && !validDate(f[key])) return `Check the ${key.replace(/([A-Z])/g, " $1").toLowerCase()}.`;
    }
    if (f.clientPostcode && !/^\d{4}$/.test(f.clientPostcode)) return "Enter a four-digit young person postcode or leave it blank.";
    if (f.commencementDate && [f.commencementDateUhr, f.commencementDateFep].some((date) => date && date < f.commencementDate)) return "Stream commencement dates must be on or after the episode commencement date.";
    if (!text(f.changeReason)) return "Record why the registration fields changed.";
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
  { staff, uid, today, version, mvpProfile = false },
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
    const intake = !mvpProfile && newIntake({
      id: uid(),
      owner: action.owner.trim(),
      today,
      actor: staff.name,
      timestamp,
    });
    if (intake) {
      intake.nextAction = action.nextAction.trim();
      intake.reviewDate = action.reviewDate;
      intake.history[0].snapshot = {
        displayName: action.name?.trim() || "Unknown",
        dob: action.dob || "Unknown",
      };
      intake.history[0].actorId = staff.id;
      intake.history[0].role = staff.role;
    }
    next.people.push({
      id,
      registrationRequestId: action.requestId,
      name: action.name?.trim() || "Name not yet known",
      nameUnknown: !text(action.name),
      dob: action.dob || null,
      pronouns: action.pronouns || "Not recorded",
      owner: action.owner.trim(),
      consent: "Not recorded",
      contact: "Not confirmed",
      family: null,
      ...(mvpProfile ? { mvpProfile: true, clientProfileRequired:
        state.settings?.clientProfileBundle !== null && state.settings?.clientProfileBundle?.enabled !== false } : {}),
      episodes: mvpProfile ? [{
        id: uid(), number: "01", status: "Active", start: today,
        programStream: action.programStream || "", disposition: "Undecided", owner: action.owner.trim(),
        collections: [], events: [], appointments: [],
      }] : [],
      intakes: intake ? [intake] : [],
      referrals: [],
    });
  } else if (action.type === "UPDATE_INTAKE_DETAILS") {
    const f = action.values;
    const previous = JSON.parse(JSON.stringify(i));
    const priorPerson = { name: p.name, dob: p.dob };
    p.name = f.name.trim();
    p.nameUnknown = false;
    p.dob = f.dob || null;
    for (const key of INTAKE_DETAIL_FIELDS) {
      if (f[key] !== undefined)
        i[key] = typeof f[key] === "string" ? f[key].trim() : f[key];
    }
    for (const key of PROFILE_FIELDS) if (f[key] !== undefined) p[key] = f[key].trim();
    const changes = [
      ...recordFieldChanges(priorPerson, p, [["name", "Name"], ["dob", "Date of birth"]]),
      ...recordFieldChanges(previous, i, INTAKE_DETAIL_FIELDS.map((key) => [key, key.replace(/([A-Z])/g, " $1")])),
    ];
    if (!changes.length) return state;
    i.revision += 1;
    i.history.unshift({
      ...history("Intake information updated", action.reason.trim()),
      changes,
      snapshot: Object.fromEntries(["name", "dob", ...INTAKE_DETAIL_FIELDS].map((key) => [key, key in f ? f[key] : i[key]])),
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
    // Whitelist editable form fields: IDs, actor and history cannot be overwritten.
    const fields = [
      "source", "referralDate", "commencementDate",
      "commencementDateUhr", "commencementDateFep", ...PROFILE_FIELDS,
    ];
    for (const key of fields)
      if (f[key] !== undefined)
        i[key] = typeof f[key] === "string" ? f[key].trim() : f[key];
    if (i.status === "Received") i.status = "In progress";
    for (const key of PROFILE_FIELDS) if (f[key] !== undefined) p[key] = f[key].trim();
    i.revision += 1;
    i.history.unshift({
      ...history("registration updated", f.changeReason.trim()),
      changes: [
        ...recordFieldChanges(previous, i, fields.map((key) => [key, key.replace(/([A-Z])/g, " $1")])),
      ],
      snapshot: Object.fromEntries(
        fields.filter((key) => f[key] !== undefined).map((key) => [key, f[key]]),
      ),
    });
  } else if (action.type === "START_ASSESSMENT") {
    if (i.episodeId) {
      const episode = p.episodes.find((item) => item.id === i.episodeId);
      episode.programStream = action.programStream;
      episode.collections[0].due = action.due;
      episode.collections[0].externalAppointment = action.externalAppointment || null;
      i.revision += 1;
      episode.events.unshift({
        id: uid(), date: today, timestamp, actor: staff.name, actorId: staff.id,
        role: staff.role, actionType: action.type, title: "Assessment planned after intake",
        detail: `${i.assessmentOwner || i.owner} owns the assessment · due ${action.due} · ${action.programStream} stream`,
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
      owner: i.assessmentOwner || i.owner,
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
          detail: `${i.owner} owns the assessment · admission undecided`,
        },
      ],
      collections: [
        {
          ...initialAssessmentCollection(i, p, version, uid),
          createdAt: timestamp,
          due: action.due,
          externalAppointment: action.externalAppointment || null,
        },
      ],
    });
    const episode = p.episodes.at(-1);
    episode.events[0].changes = careChanges(null, episode);
    i.history.unshift(
      history(
        "Assessment handoff recorded",
        `Initial assessment due ${action.due} · ${i.assessmentOwner || i.owner}`,
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
    ...(p.mvpProfile ? [] : p.intakes || [])
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
