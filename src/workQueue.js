import { assessmentDueDatesEnabled, assessmentSchedulingEnabled } from './assessmentFeatures.js';
import { initialAssessmentReadyForOutcome } from './assessmentOutcome.js';
import { canAssess } from './intake.js';
import { getTasks, hasPendingClinicalReview, TODAY } from './model.js';
import { matchesWorkOwner, ownedTasks } from './workflow.js';

export const WORK_STAGES = ['All stages', 'Client profile', 'Initial assessment', '90-day review', 'Intake', 'Referrals', 'Other measures'];

export function workStage(task) {
  if (task.kind === 'intake') return 'Intake';
  if (task.kind === 'referral') return 'Referrals';
  if (task.collection?.clientProfileMeasure) return 'Client profile';
  if (task.collection?.mvpInitialAssessment) return 'Initial assessment';
  if (task.collection?.mvpTimepointId) return '90-day review';
  return 'Other measures';
}

const collectionGroupKey = task => task.collection?.bundleInstanceId || task.collection?.bundleId || task.collection?.id;
const workKey = task => task.collection
  ? `${task.person.id}:${task.episode.id}:${collectionGroupKey(task)}`
  : `${task.person.id}:${task.kind}:${task.record.id}`;

const statusForGroup = (records, showDueDates, today) => {
  if (records.some(hasPendingClinicalReview)) return 'Ready for review';
  const open = records.filter(record => record.response !== 'Submitted' && !['Cancelled', 'Paused'].includes(record.assignment));
  if (!open.length) return 'Completed';
  if (showDueDates && open.some(record => record.due && record.due < today)) return 'Overdue';
  if (showDueDates && open.some(record => record.due === today)) return 'Due today';
  if (records.some(record => record.response === 'Draft' || record.response === 'In progress' || record.response === 'Submitted')) return 'In progress';
  if (showDueDates && open.every(record => !record.due)) return 'Needs planning';
  return 'Not started';
};

export function getWorkItems(state, ownership = 'me', today = TODAY) {
  const showDueDates = assessmentSchedulingEnabled(state.settings) || assessmentDueDatesEnabled(state.settings);
  const groups = new Map();
  const rawTasks = getTasks(state).filter(task => !task.collection?.notRequiredReason);
  const rawIds = new Set(rawTasks.map(task => task.collection?.id).filter(Boolean));
  const pendingReviews = (state.people || []).filter(person => !person.archivedAt)
    .flatMap(person => (person.episodes || []).filter(episode =>
      ['Active', 'Closed'].includes(episode.status) && canAssess(person, episode))
      .flatMap(episode => (episode.collections || []).filter(collection =>
        hasPendingClinicalReview(collection) && !collection.notRequiredReason &&
        !['Cancelled', 'Paused'].includes(collection.assignment) &&
        (!person.mvpProfile || collection.clientProfileMeasure || collection.mvpInitialAssessment || collection.mvpTimepointId) &&
        !rawIds.has(collection.id))
        .map(collection => ({ person, episode, collection, status: 'Ready for review', action: 'Review responses' }))));
  for (const task of ownedTasks([...rawTasks, ...pendingReviews], state, ownership)) {
    const key = workKey(task);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(task);
  }
  const items = [...groups.entries()].map(([id, tasks]) => {
    const first = tasks[0];
    if (!first.collection) return { ...first, id, stage: workStage(first), title: first.kind === 'intake'
      ? 'Intake' : `Referral · ${first.record.destination}`, due: first.record.reviewDate };
    const records = first.episode.collections.filter(record =>
      collectionGroupKey({ collection: record }) === collectionGroupKey(first) &&
      !record.notRequiredReason && !['Cancelled', 'Paused'].includes(record.assignment));
    const open = records.filter(record => record.response !== 'Submitted' && !['Cancelled', 'Paused'].includes(record.assignment));
    const status = statusForGroup(records, showDueDates, today);
    const target = status === 'Ready for review'
      ? tasks.find(task => task.status === 'Ready for review') || first
      : tasks.find(task => task.collection.response === 'Draft') || tasks.find(task => task.collection.response !== 'Submitted') || first;
    return { ...target, id, stage: workStage(first), title: first.collection.bundleName || first.collection.label,
      status, action: status === 'Ready for review' ? 'Review responses'
        : status === 'Needs planning' ? 'Plan measure' : status === 'In progress' ? 'Continue measure' : 'Open measure',
      due: open.map(record => record.due).filter(Boolean).sort()[0] || '',
      completed: records.filter(record => record.response === 'Submitted').length, total: records.length };
  });
  for (const person of state.people || []) {
    if (!person.mvpProfile || person.archivedAt) continue;
    for (const episode of person.episodes || []) {
      if (episode.status !== 'Active' || !initialAssessmentReadyForOutcome(episode, state.settings) ||
        episode.assessmentOutcome?.value || !matchesWorkOwner(episode.owner || person.owner, state, ownership)) continue;
      const collection = episode.collections.find(record => record.mvpInitialAssessment);
      if (!collection) continue;
      items.push({ id: `${person.id}:${episode.id}:outcome`, person, episode, collection,
        stage: 'Initial assessment', title: collection.bundleName || 'Initial assessment',
        status: 'Record outcome', action: 'Record outcome', due: collection.due,
        completed: episode.collections.filter(record => record.mvpInitialAssessment && record.response === 'Submitted').length,
        total: episode.collections.filter(record => record.mvpInitialAssessment).length });
    }
  }
  const priority = status => ({ Overdue: 0, 'Record outcome': 1, 'Ready for review': 2,
    'Due today': 3, 'Needs planning': 4, 'In progress': 5, 'Sending failed': 6, Declined: 7 })[status] ?? 8;
  return items.sort((a, b) => priority(a.status) - priority(b.status) ||
    (a.due || '9999-12-31').localeCompare(b.due || '9999-12-31') || a.id.localeCompare(b.id));
}

export const workNeedsAttention = item =>
  ['Overdue', 'Due today', 'Record outcome', 'Needs planning', 'Sending failed', 'Declined', 'Awaiting information'].includes(item.status);
