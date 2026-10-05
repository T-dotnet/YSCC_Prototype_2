import { derivedEpisodeStatus, EPISODE_DISPLAY_STATUSES } from './batch1Registration.js';

export const EPISODE_TRIGGER_STATUSES = EPISODE_DISPLAY_STATUSES;

export const episodeStatusTriggerError = rule => rule.after === 'episode-status' &&
  !EPISODE_TRIGGER_STATUSES.includes(rule.triggerEpisodeStatus)
  ? 'Choose an episode status.' : null;

export function episodeStatusSource(episode, settings, status, today) {
  if (!EPISODE_TRIGGER_STATUSES.includes(status) ||
      derivedEpisodeStatus({}, episode, settings) !== status) return null;
  const records = episode.collections || [];
  const date = record => (record.submittedTimestamp || record.submittedAt ||
    record.responseDate || record.createdAt || record.due || '').slice(0, 10);
  const profile = records.filter(record => record.clientProfileMeasure);
  const initial = records.filter(record => record.mvpInitialAssessment && record.mvpRespondent === 'Person');
  const latest = items => items.map(date).filter(Boolean).sort().at(-1);
  const firstTransition = target => records.filter(record => record.response === 'Submitted' &&
    record.bundleContext?.statusChange === target).map(date).filter(Boolean).sort()[0];
  let anchor = episode.start;
  if (status === 'Profiling') anchor = profile.map(record =>
    (record.createdAt || record.due || '').slice(0, 10)).filter(Boolean).sort()[0] || episode.start;
  if (status === 'Assessment') anchor = profile.length && profile.every(record => record.response === 'Submitted')
    ? latest(profile) || episode.start : firstTransition(status) || episode.start;
  if (status === 'Ongoing review') anchor = episode.assessmentOutcome?.recordedAt?.slice(0, 10) ||
    firstTransition(status) || latest(initial) || episode.start;
  if (status === 'Not proceed') anchor = episode.assessmentOutcome?.recordedAt?.slice(0, 10) ||
    latest(initial) || episode.start;
  if (status === 'Discharged') anchor = episode.end;
  return anchor && anchor <= today ? { anchor, timingSourceId: `episode-status:${status}`,
    ...(status === 'Discharged' ? { dischargeFollowUp: true } : {}) } : null;
}
