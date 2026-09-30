// Older saved workspaces have only the presentation-mode setting. Preserve
// their existing behaviour until each feature is explicitly configured.
import { mvpAssessmentMode } from './mvpAssessmentPathway.js';

export const assessmentSchedulingEnabled = (settings) =>
  settings?.scheduleAssessments ?? !settings?.simpleAssessments;

// Display only: this switch must never grant assessment/contact scheduling.
export const assessmentDueDatesEnabled = (settings) =>
  mvpAssessmentMode(settings) || (settings?.showAssessmentDueDates ?? true);

export const assessmentContactLinkingEnabled = (settings) =>
  settings?.linkAssessmentAppointments ?? !settings?.simpleAssessments;

export const assessmentModalityEnabled = (settings) =>
  settings?.assessmentModality ?? true;

export const assessmentSmsEnabled = (settings) =>
  settings?.assessmentSms ?? true;

export const assessmentBundleGroupingEnabled = (settings) =>
  mvpAssessmentMode(settings) || (settings?.groupAssessmentsByBundle ?? false);

export const assessmentBundleAccordionsEnabled = (settings) =>
  settings?.bundleAccordions ?? false;

export const assessmentHistoryEntryVisible = (entry, settings, contacts = []) => {
  const linkedContact = contacts.find(contact => contact.id === entry.appointmentId);
  if (linkedContact && !contactVisible(linkedContact, settings)) return false;
  const title = entry.title || "";
  const detail = entry.detail || "";
  if (!assessmentSchedulingEnabled(settings) &&
      (entry.type === "appointment" && entry.attendance === "Planned" ||
        title === "Contact planned" || title === "Appointment planned")) return false;
  if (!assessmentSmsEnabled(settings) &&
      (entry.channel === "SMS link" || entry.deliveryMode === "SMS" || title.includes("SMS") ||
        title === "Sample questionnaire link prepared" || detail.includes("SMS link"))) return false;
  if (!assessmentContactLinkingEnabled(settings) &&
      (title === "Assessment contact linked" || title === "Contact linked to assessment")) return false;
  if (!assessmentSchedulingEnabled(settings) &&
      (title === "Follow-up planned" || title === "Assessment scheduled")) return false;
  return true;
};

// Presentation only: retain saved planned contacts so switching scheduling back
// on restores them. Recorded outcomes remain visible even without an actual date.
export const contactVisible = (contact, settings) =>
  assessmentSchedulingEnabled(settings) || contact.attendance !== "Planned";

export const episodeWithVisibleContacts = (episode, settings) => !episode || assessmentSchedulingEnabled(settings)
  ? episode
  : { ...episode, appointments: (episode.appointments || []).filter(contact => contactVisible(contact, settings)) };

export const personWithVisibleContacts = (person, settings) => !person || assessmentSchedulingEnabled(settings)
  ? person
  : { ...person, episodes: person.episodes.map(episode => episodeWithVisibleContacts(episode, settings)) };
