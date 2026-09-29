// Product vocabulary. UI labels and the generated glossary both read this file.
// Storage keys and persisted values are retained for saved-workspace compatibility.
export const TERMINOLOGY = Object.freeze({
  collectionMethod: {
    label: "Collection method",
    definition: "How instrument responses are collected within an assessment. An assessment has a shared collection method; each response session records the method used.",
    aliases: ["Modality", "Assessment modality", "Delivery channel", "Channel", "Delivery method"],
    fields: ["collection.channel", "attempt.channel", "bundle.assessments[].channel"],
    options: [["Clinician entry", "Clinician entry"], ["Clinic tablet", "Clinic tablet"], ["SMS link", "SMS link"]],
  },
  contactMethod: {
    label: "Contact method",
    definition: "How a service contact takes place, such as in person, by phone or by video. This is separate from the method used to collect instrument answers during that contact.",
    aliases: ["Delivery mode", "Delivery method"],
    fields: ["appointment.deliveryMode", "externalAppointment.deliveryMode"],
  },
  deliveryMethod: {
    label: "Delivery method",
    definition: "How a consent request is delivered or presented. Use this label in consent forms, details and filters.",
    aliases: ["Delivery channel", "Channel"],
    fields: ["consentRequest.channel"],
  },
  respondent: {
    label: "Respondent",
    definition: "The person supplying instrument answers within an assessment: the patient or a family respondent. The respondent can differ from the person entering the answers.",
    aliases: ["Recipient (assessment only)"],
    fields: ["collection.respondent", "attempt.respondent", "bundle.assessments[].recipient"],
  },
  recipient: {
    label: "Recipient",
    definition: "The person receiving a service contact or a consent request. Use Respondent when referring to the person supplying instrument answers.",
    aliases: [],
    fields: ["appointment.recipientType"],
  },
  assistance: {
    label: "Assistance",
    definition: "Support provided while completing a response. Record this separately from collection method, respondent and recorder.",
    aliases: ["Completion support", "Support level"],
    fields: ["collection.assistance", "attempt.assistance"],
  },
  recorder: {
    label: "Recorder",
    definition: "The person entering or transcribing instrument answers. Recording answers does not make the recorder the respondent.",
    aliases: [],
    fields: ["collection.recorder", "attempt.recorderName"],
  },
  assessment: {
    label: "Assessment",
    definition: "A collection of instruments with a shared name, respondent, collection method and schedule. Completion tracks the responses to each included instrument.",
    aliases: ["Assessment bundle", "Bundle"],
    fields: ["settings.assessmentScheduleRules[]", "episode.assessmentBundleInstances[]", "collection.bundleId"],
  },
  instrument: {
    label: "Instrument",
    definition: "A versioned set of questions included in an assessment. Each assigned instrument has its own answers, response status and collection sessions. Instruments can also be recorded individually.",
    aliases: ["Questionnaire", "Collection (record name)"],
    fields: ["collection.version", "instrument.questions", "episode.collections[]"],
  },
  serviceContact: {
    label: "Service contact",
    definition: "A planned or actual direct service contact, with attendance and contact details. Contact is an acceptable short label; appointment describes the booked arrangement. Indirect activity remains separate.",
    aliases: [],
    fields: ["episode.appointments[]"],
  },
  careEvents: {
    label: "Care events",
    definition: "The combined care chronology, including service contacts, assessments, contextual events and structured care records. Each source record retains its own meaning.",
    aliases: [],
    fields: ["derived care chronology"],
  },
  programStream: {
    label: "Program stream",
    definition: "The program stream recorded for a care period, also used by assessment conditions. Use the full label in fields, tables and conditions.",
    aliases: ["Program", "Stream (field label)"],
    fields: ["carePeriod.programStream", "bundle.programStream"],
  },
  careLevel: {
    label: "Care level",
    definition: "The level recorded for an effective-dated care period. Terminology consolidation does not establish approved care-intensity or reporting mappings.",
    aliases: [],
    fields: ["carePeriod.careLevel", "bundle.careLevel"],
  },
});

export const LABELS = Object.freeze(Object.fromEntries(
  Object.entries(TERMINOLOGY).map(([key, term]) => [key, term.label]),
));
export const COLLECTION_METHOD_OPTIONS = TERMINOLOGY.collectionMethod.options;
export const collectionMethodLabel = (value, fallback = "Not recorded") =>
  COLLECTION_METHOD_OPTIONS.find(([stored]) => stored === value)?.[1] || value || fallback;

export const COLLECTION_METHOD_SETTING_LABEL = "Assessment collection methods";
export const PLANNED_COLLECTION_METHOD_LABEL = `Planned ${LABELS.collectionMethod.toLowerCase()}`;

// Normalize only display labels. Historical audit records and stored keys stay intact.
export function terminologyLabel(label, concept) {
  const term = TERMINOLOGY[concept];
  return term && (label === term.label || term.aliases.includes(label)) ? term.label : label;
}
