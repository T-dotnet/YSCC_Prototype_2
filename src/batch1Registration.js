// Current Batch 1 registration responses from the 2025 headspace EP extract codebook.
// Historical response codes and extract-only missing codes are intentionally omitted
// from new-entry controls. Existing values remain visible in the intake form.
import { completedMeasureStatusChange } from './measureStatusChange.js';
import { assessmentOutcomeAllowsOngoingReview, assessmentOutcomeEnabled, initialAssessmentStatusChange } from './assessmentOutcome.js';
import { EP_BATCH_2_INSTRUMENTS } from './epCodebookInstruments.js';

export const EPISODE_DISPLAY_STATUSES = [
  'Profiling', 'Assessment', 'Ongoing review', 'Not proceed',
  'Paused', 'Closed', 'Completed', 'Discharged',
];

const assessmentOutcomeInstrument = EP_BATCH_2_INSTRUMENTS.find(
  instrument => instrument.codebookDataItem === 'Assessment Outcome');
const assessmentOutcomeIndex = assessmentOutcomeInstrument?.questions.findIndex(
  question => question.id === 'assessment_outcome');

function notProceedAssessmentOutcome(episode, settings) {
  if (episode?.assessmentOutcome?.value) {
    const code = Number(/^\d+/.exec(episode.assessmentOutcome.value)?.[0]);
    return code >= 3 && code <= 13;
  }
  if (assessmentOutcomeEnabled(settings) && (episode?.collections || []).some(record =>
    record.mvpInitialAssessment && record.mvpRespondent === 'Person')) return false;
  if (assessmentOutcomeIndex < 0) return false;
  const latest = (episode?.collections || []).filter(record =>
    record.version === assessmentOutcomeInstrument?.version &&
    record.response === 'Submitted').sort((a, b) =>
    (b.submittedTimestamp || b.submittedAt || '').localeCompare(
      a.submittedTimestamp || a.submittedAt || ''))[0];
  const code = Number(/^\d+/.exec(latest?.answers?.[assessmentOutcomeIndex] || '')?.[0]);
  return code >= 3 && code <= 13;
}
export const REFERRAL_SOURCES = [
  "Self-referred",
  "Family / Friend",
  "headspace",
  "Healthcare Provider; Primary health care - GP",
  "Healthcare Provider; Community-based mental health service (eg, CAMHS, AMHS)",
  "Healthcare Provider; Private psychiatrist / community-based allied health provider",
  "Healthcare Provider; Inpatient mental health and hospital-based services",
  "Healthcare Provider; Emergency department",
  "Community Service; School-based service - school psychologist, guidance or welfare worker",
  "Community Service; Welfare / employment agency, other community service",
  "Community Service; Legal, justice, child protection services",
  "Community Service; Alcohol or other drug service",
];

export const GENDER_OPTIONS = [
  "Female", "Male", "Gender Diverse", "Indeterminate", "Trans man",
  "Gender fluid", "Gender questioning", "Agender", "Non-binary",
  "Sistergirl", "Brotherboy", "Trans women", "Prefer not to answer",
];

export const SEXUALITY_OPTIONS = [
  "Straight / Heterosexual", "Lesbian", "Gay", "Bisexual", "Other Sexuality; Queer",
  "Other Sexuality; Pansexual", "Other Sexuality; Asexual", "Other Sexuality; Any other sexuality not listed here",
  "Questioning", "I don't know what these words mean",
  "Other sexuality (e.g. queer, pansexual)", "Prefer not to answer",
];

export const ATSI_OPTIONS = [
  "No", "Aboriginal", "Torres Strait Islander",
  "Aboriginal and Torres Strait Islander", "Prefer not to answer",
];

export const EDUCATION_OPTIONS = [
  "Year 10 or below", "Year 11", "Year 12",
  "Certificate (includes apprenticeship or traineeship)",
  "Diploma or Advanced Diploma", "Bachelor Degree",
  "Graduate Diploma or Graduate Certificate", "Postgraduate Degree",
];

export const PROFILE_FIELDS = [
  "clientPostcode", "clientGender", "clientSexuality", "clientAtsiStatus",
  "clientCountryOfBirth", "clientLanguageHome", "clientEthnicity",
  "clientEducationLevel",
];

// Batch 1 centre fields describe the registered centre, rather than the young person.
export const REGISTERED_CENTRE_STATES = [
  "New South Wales", "Northern Territory", "Queensland", "South Australia",
  "Victoria", "Western Australia", "Australian Capital Territory",
];

export const PROFILE_EPISODE_FIELDS = [
  "source", "referralDate", "commencementDate", "commencementDateUhr",
  "commencementDateFep", "registeredCentreName", "registeredCentreState",
  "registeredCentrePostcode",
];

export function ageAtCommencement(dob, commencementDate) {
  if (!dob || !commencementDate || dob > commencementDate) return null;
  const birth = new Date(`${dob}T12:00:00Z`);
  const start = new Date(`${commencementDate}T12:00:00Z`);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(start.getTime())) return null;
  let age = start.getUTCFullYear() - birth.getUTCFullYear();
  if (start.getUTCMonth() < birth.getUTCMonth() ||
      (start.getUTCMonth() === birth.getUTCMonth() && start.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

export function derivedEpisodeStream(intake, episode) {
  const uhr = intake?.commencementDateUhr;
  const fep = intake?.commencementDateFep;
  if (uhr && fep) return uhr < fep ? "Transitioned" : "Check commencement dates";
  if (uhr) return "UHR";
  if (fep) return "FEP";
  if (episode?.programStream === "UHR" || episode?.programStream === "FEP")
    return `${episode.programStream} · service date needed to verify`;
  if (!episode || intake?.status === "Received" || intake?.status === "In progress")
    return "In Assessment";
  return "Unknown";
}

export function derivedEpisodeStatus(intake, episode, settings) {
  if (episode?.status === "Discharged" ||
      (episode?.status === "Closed" && episode?.disposition === "Discharged")) return "Discharged";
  if (episode?.status && episode.status !== "Active") return episode.status;
  if (notProceedAssessmentOutcome(episode, settings)) return "Not proceed";
  const completedStatus = completedMeasureStatusChange(episode, settings);
  if (completedStatus) return completedStatus;
  const profile = (episode?.collections || []).filter(record => record.clientProfileMeasure);
  if (profile.length) {
    if (profile.some(record => record.response !== "Submitted")) return "Profiling";
    const initial = episode.collections.filter(record =>
      record.mvpInitialAssessment && record.mvpRespondent === "Person");
    if (!initial.length || initial.some(record => record.response !== "Submitted"))
      return "Assessment";
    return initial.some(record => initialAssessmentStatusChange(record, settings) === 'Ongoing review') &&
      assessmentOutcomeAllowsOngoingReview(episode, settings) ? "Ongoing review" : "Assessment";
  }
  const initial = (episode?.collections || []).filter(record =>
    record.mvpInitialAssessment && record.mvpRespondent === "Person");
  if (initial.length && initial.every(record => record.response === "Submitted"))
    return initial.some(record => initialAssessmentStatusChange(record, settings) === 'Ongoing review') &&
      assessmentOutcomeAllowsOngoingReview(episode, settings) ? "Ongoing review" : "Assessment";
  return "Assessment";
}
