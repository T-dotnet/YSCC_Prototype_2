import test from 'node:test';
import assert from 'node:assert/strict';
import { measureStatusSources, specificMeasureError } from './measureTriggers.js';
import { reconcileAssessmentBundles } from './assessmentBundles.js';

const sourceId = 'MVP-CLIENT-PROFILE';
const profile = (id, extra = {}) => ({ id, bundleId: 'MVP-CLIENT-PROFILE-EP',
  clientProfileMeasure: true, response: 'Not started', due: '2026-10-02', ...extra });
const records = [1, 2, 3, 4].map(index => profile(String(index)));

test('a specific measure fires only when the whole source measure reaches its selected status', () => {
  const episode = { collections: records };
  assert.deepEqual(measureStatusSources(episode, sourceId, 'completed', '2026-10-02'), []);
  assert.deepEqual(measureStatusSources(episode, sourceId, 'overdue', '2026-10-02'), []);
  assert.equal(measureStatusSources(episode, sourceId, 'overdue', '2026-10-03')[0].anchor, '2026-10-03');
  episode.collections = records.map(record => ({ ...record, response: 'Submitted', submittedAt: '2026-10-04' }));
  assert.equal(measureStatusSources(episode, sourceId, 'completed', '2026-10-04')[0].anchor, '2026-10-04');
  episode.collections = records.map(record => ({ ...record, notRequiredReason: 'Not applicable', notRequiredAt: '2026-10-05T12:00:00Z' }));
  assert.equal(measureStatusSources(episode, sourceId, 'not-required', '2026-10-05')[0].anchor, '2026-10-05');
});

test('a scheduled measure follows Client profile completion and is created once', () => {
  const rule = { id: 'FOLLOW-UP', name: 'Follow-up', trigger: 'current', timing: 'days', after: 'specific-measure',
    triggerMeasureId: sourceId, triggerMeasureStatus: 'completed', days: 1, repeat: false,
    programStream: 'All', careLevel: 'All', enabled: true, channel: 'Clinic tablet', recipient: 'Person',
    assessments: [{ id: 'one', version: 'EP Batch 2 · Living Situation v1.0', requirement: 'Mandatory' }] };
  assert.equal(specificMeasureError(rule), null);
  assert.ok(specificMeasureError({ ...rule, triggerMeasureStatus: '' }));
  const initial = { settings: { automaticAssessmentDueDates: true, assessmentScheduleRules: [rule] },
    people: [{ id: 'P', episodes: [{ id: 'EP', status: 'Active', start: '2026-10-02',
      carePeriods: [{ startDate: '2026-10-02', endDateExclusive: null, programStream: 'Mood', careLevel: 'Mid' }],
      collections: records }] }] };
  assert.equal(reconcileAssessmentBundles(initial, '2026-10-03'), initial);
  const completed = structuredClone(initial);
  completed.people[0].episodes[0].collections = records.map(record => ({ ...record, response: 'Submitted', submittedAt: '2026-10-04' }));
  const scheduled = reconcileAssessmentBundles(completed, '2026-10-04');
  const added = scheduled.people[0].episodes[0].collections.filter(record => record.scheduleRuleId === rule.id);
  assert.equal(added.length, 1);
  assert.equal(added[0].due, '2026-10-05');
  assert.equal(reconcileAssessmentBundles(scheduled, '2026-10-05'), scheduled);
});

test('a profile data field value gates an otherwise ready measure', () => {
  const rule = { id: 'FIELD-RULE', name: 'Field rule', trigger: 'current', timing: 'days', after: 'care-period',
    days: 1, repeat: false, programStream: 'All', careLevel: 'All', enabled: true,
    channel: 'Clinic tablet', recipient: 'Person', triggerDataEnabled: true,
    triggerDataField: 'contact', triggerDataValue: 'Suitable',
    assessments: [{ id: 'one', version: 'EP Batch 2 · Living Situation v1.0', requirement: 'Mandatory' }] };
  const initial = { settings: { automaticAssessmentDueDates: true, assessmentScheduleRules: [rule] },
    people: [{ id: 'P', contact: 'Not confirmed', episodes: [{ id: 'EP', status: 'Active', start: '2026-10-02',
      carePeriods: [{ startDate: '2026-10-02', endDateExclusive: null, programStream: 'Mood', careLevel: 'Mid' }],
      collections: [] }] }] };
  assert.equal(reconcileAssessmentBundles(initial, '2026-10-03'), initial);
  const ready = structuredClone(initial);
  ready.people[0].contact = 'Suitable';
  const scheduled = reconcileAssessmentBundles(ready, '2026-10-03');
  assert.equal(scheduled.people[0].episodes[0].collections.length, 1);
});
