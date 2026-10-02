import { ATSI_OPTIONS, REFERRAL_SOURCES } from './batch1Registration.js';

export const PROFILE_TRIGGER_FIELDS = [
  { id: 'consent', label: 'Assessment participation', values: ['Recorded', 'Not recorded', 'Withdrawn'] },
  { id: 'contact', label: 'Contact suitability', values: ['Suitable', 'Not confirmed', 'Unsuitable', 'Not yet assessed'] },
  { id: 'source', label: 'Referral source', values: REFERRAL_SOURCES },
  { id: 'clientAtsiStatus', label: 'Aboriginal and/or Torres Strait Islander', values: ATSI_OPTIONS },
];

export function profileValueTriggerError(rule) {
  if (!rule.triggerDataEnabled) return null;
  const field = PROFILE_TRIGGER_FIELDS.find(item => item.id === rule.triggerDataField);
  if (!field) return 'Choose a profile data field.';
  if (!field.values.includes(rule.triggerDataValue)) return 'Choose a value for the selected data field.';
  return null;
}

export function profileValueMatches(rule, person, episode) {
  if (!rule.triggerDataEnabled) return true;
  if (profileValueTriggerError(rule)) return false;
  const intake = person.intakes?.find(item => item.episodeId === episode.id);
  const value = rule.triggerDataField === 'source'
    ? episode.profileDetails?.source || intake?.source
    : rule.triggerDataField === 'clientAtsiStatus'
      ? person.clientAtsiStatus || intake?.clientAtsiStatus
      : person[rule.triggerDataField];
  return value === rule.triggerDataValue;
}
