// Product vocabulary. UI labels and the generated glossary both read this file.
// Storage keys and persisted values are retained for saved-workspace compatibility.
// Shared plural labels remain separate from Pack and Collection Occasion labels.
export const PRODUCT_TERMS = Object.freeze({
  measures: Object.freeze({ singular: "Measure", label: "Measures" }),
  contacts: Object.freeze({ singular: "Contact", label: "Contacts" }),
});

export const TERMINOLOGY = Object.freeze({
  measures: {
    ...PRODUCT_TERMS.measures,
    definition: "Multiple standardised instruments; each completed measure yields a Response.",
    aliases: [],
    fields: [],
  },
  contactSection: {
    ...PRODUCT_TERMS.contacts,
    definition: "Recorded pieces of service activity in a young person’s episode.",
    aliases: [],
    fields: [],
  },
  episode: {
    label: "Episode",
    definition: "A young person’s episode of care.",
    aliases: ["Care episode"],
    fields: ["episode"],
  },
  contact: {
    label: "Contact",
    definition: "One recorded piece of service activity.",
    aliases: ["Service contact"],
    fields: ["episode.appointments[]"],
  },
  measure: {
    label: "Measure",
    definition: "A single standardised instrument, such as K10 or SOFAS.",
    aliases: ["Instrument (when referring to a standardised measure)"],
    fields: ["collection.version", "instrument.questions"],
  },
  assessmentPack: {
    label: "Assessment Pack",
    definition: "A defined set of measures issued at a particular point in care. Pack is an acceptable short form in discussion.",
    aliases: ["Assessment bundle", "Bundle"],
    fields: ["settings.assessmentScheduleRules[]"],
  },
  collectionOccasion: {
    label: "Collection Occasion",
    definition: "One Assessment Pack issued to one young person at one point in time. Collection is an acceptable short form in discussion.",
    aliases: ["Collection"],
    fields: ["episode.assessmentBundleInstances[]", "collection.bundleId"],
  },
  response: {
    label: "Response",
    definition: "One completed measure within a Collection Occasion.",
    aliases: [],
    fields: ["collection.answers", "collection.submittedAt"],
  },
  collectionMethod: {
    label: "Collection method",
    definition: "How measure responses are collected within a Collection Occasion. Each response session records the method used.",
    aliases: ["Modality", "Assessment modality", "Delivery channel", "Channel", "Delivery method"],
    fields: ["collection.channel", "attempt.channel", "bundle.assessments[].channel"],
    options: [["Clinician entry", "Clinician entry"], ["Clinic tablet", "Clinic tablet"], ["SMS link", "SMS link"]],
  },
  contactMethod: {
    label: "Contact method",
    definition: "How a service contact takes place, such as in person, by phone or by video. This is separate from the method used to collect measure answers during that contact.",
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
    definition: "The person supplying answers to a measure: the young person or a clinician. The respondent can differ from the person entering the answers.",
    aliases: ["Recipient (assessment only)"],
    fields: ["collection.respondent", "attempt.respondent", "bundle.assessments[].recipient"],
  },
  recipient: {
    label: "Recipient",
    definition: "The person receiving a service contact or a consent request. Use Respondent when referring to the person supplying measure answers.",
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
    definition: "The person entering or transcribing measure answers. Recording answers does not make the recorder the respondent.",
    aliases: [],
    fields: ["collection.recorder", "attempt.recorderName"],
  },
  serviceContact: {
    label: "Service contact",
    definition: "A planned or actual direct service contact, with attendance and contact details. A recorded contact is one piece of service activity; appointment describes the booked arrangement.",
    aliases: [],
    fields: ["episode.appointments[]"],
  },
  careEvents: {
    label: "Care chronology",
    definition: "The combined care chronology, including contacts, collection occasions, contextual events and structured care records. Each source record retains its own meaning.",
    aliases: ["Care event", "Care events"],
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

export const COLLECTION_METHOD_SETTING_LABEL = `${TERMINOLOGY.collectionOccasion.label} methods`;
export const PLANNED_COLLECTION_METHOD_LABEL = `Planned ${LABELS.collectionMethod.toLowerCase()}`;

export const APP_TERMS = Object.freeze({
  measures: TERMINOLOGY.measures,
  contacts: TERMINOLOGY.contactSection,
});

export const appTerm = (key, form = "label") => APP_TERMS[key]?.[form] || APP_TERMS[key]?.label || key;

// Never infer a record type from the generic word "assessment". It can refer to
// a pack definition, an issued occasion, or a completed measure depending on context.
// Keep saved names and historical audit text verbatim.
export function displayTerminology(value) {
  return value;
}

// Normalize only display labels. Historical audit records and stored keys stay intact.
export function terminologyLabel(label, concept) {
  const term = TERMINOLOGY[concept];
  return term && (label === term.label || term.aliases.includes(label)) ? term.label : label;
}
