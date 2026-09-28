// Product vocabulary. UI labels and the generated glossary both read this file.
// Storage keys and persisted values are retained for saved-workspace compatibility.
export const TERMINOLOGY = Object.freeze({
  collectionMethod: {
    label: "Collection method",
    definition: "How an assessment response is collected. The method belongs to each response session; an assessment may use more than one method across sessions.",
    aliases: ["Modality", "Assessment modality", "Delivery channel", "Channel", "Delivery method"],
    fields: ["collection.channel", "attempt.channel", "bundle.assessments[].channel"],
    options: [["Clinician entry", "Clinician entry"], ["Clinic tablet", "Clinic tablet"], ["SMS link", "SMS link"]],
  },
  contactMethod: {
    label: "Contact method",
    definition: "How a service contact takes place, such as in person, by phone or by video. This is separate from the method used to collect questionnaire answers during that contact.",
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
    definition: "The person supplying assessment answers: the patient or a family respondent. The respondent can differ from the person entering the answers.",
    aliases: ["Recipient (assessment only)"],
    fields: ["collection.respondent", "attempt.respondent", "bundle.assessments[].recipient"],
  },
  recipient: {
    label: "Recipient",
    definition: "The person receiving a service contact or a consent request. Use Respondent when referring to the person supplying assessment answers.",
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
    definition: "The person entering or transcribing assessment answers. Recording answers does not make the recorder the respondent.",
    aliases: [],
    fields: ["collection.recorder", "attempt.recorderName"],
  },
  assessment: {
    label: "Assessment",
    definition: "One assigned assessment record, including its questionnaire version, response status, sessions and optional due date. A collection is the underlying stored record.",
    aliases: ["Collection (record name)"],
    fields: ["episode.collections[]"],
  },
  questionnaire: {
    label: "Questionnaire",
    definition: "The versioned set of questions used by an assessment. Assessment type and questionnaire version remain distinct.",
    aliases: [],
    fields: ["collection.version", "instrument.questions"],
  },
  assessmentBundle: {
    label: "Assessment bundle",
    definition: "A configured group of mandatory and optional assessments, with collection methods, respondents and eligibility or trigger conditions. Bundle is an acceptable short label in context.",
    aliases: [],
    fields: ["settings.assessmentScheduleRules[]", "collection.bundleId"],
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
    definition: "The program stream recorded for a care period, also used by assessment-bundle conditions. Use the full label in fields, tables and conditions.",
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
