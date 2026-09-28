import { formatDate } from "./model.js";

export function patientIdentifier(person) {
  if (person?.name) return person.name;
  if (person?.id) return person.id;
  if (person?.dob) return `DOB ${formatDate(person.dob)}`;
  return "Patient ID unavailable";
}

export function patientSecondaryDetail(person) {
  return [person?.id, person?.dob ? `DOB ${formatDate(person.dob)}` : null].filter(Boolean).join(" · ") || null;
}
