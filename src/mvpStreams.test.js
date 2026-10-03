import test from 'node:test';
import assert from 'node:assert/strict';
import { PROGRAM_STREAMS } from './carePeriods.js';
import { createDefaultWorkspace, reducer, TODAY } from './model.js';
import { mvpInitialBundles, mvpInitialBundleError, mvpReviewBundles,
  mvpReviewBundleError, reconcileMvpAssessmentPathway } from './mvpAssessmentPathway.js';

test('the MVP offers exactly four episode streams with valid initial and review bundles', () => {
  assert.deepEqual(PROGRAM_STREAMS, ['Psychosis', 'Eating Disorder', 'Personality', 'Mood']);
  const settings = createDefaultWorkspace().settings;
  assert.deepEqual(mvpInitialBundles(settings).map(bundle => bundle.programStream), PROGRAM_STREAMS);
  assert.deepEqual(mvpReviewBundles(settings).map(bundle => bundle.programStream), PROGRAM_STREAMS);
  for (const bundle of mvpInitialBundles(settings)) assert.equal(mvpInitialBundleError(bundle, settings), null);
  for (const bundle of mvpReviewBundles(settings)) assert.equal(mvpReviewBundleError(bundle, settings), null);
});

test('fresh fictional episodes cover all streams and each stream can prepare measures', () => {
  const workspace = createDefaultWorkspace();
  const activeStreams = new Set(workspace.people.flatMap(person => person.episodes)
    .filter(episode => episode.status === 'Active').map(episode => episode.programStream));
  assert.deepEqual(activeStreams, new Set(PROGRAM_STREAMS));

  for (const stream of PROGRAM_STREAMS) {
    const episode = { id: 'E', status: 'Active', start: '2026-01-01', programStream: stream,
      carePeriods: [{ startDate: '2026-01-01', endDateExclusive: null, programStream: stream, careLevel: 'Mid' }],
      collections: [], events: [] };
    const state = { settings: { advancedAssessmentOptions: false, assessmentSms: true },
      people: [{ id: 'P', name: 'Fictional person', dob: '2000-01-01', episodes: [episode] }] };
    const prepared = reconcileMvpAssessmentPathway(state, '2026-03-25').people[0].episodes[0];
    assert.ok(prepared.collections.some(record => record.mvpInitialAssessment), stream);
    assert.ok(prepared.collections.some(record => record.mvpTimepointId), stream);
  }
});

test('a new profile stores the selected episode stream', () => {
  const workspace = createDefaultWorkspace();
  for (const stream of PROGRAM_STREAMS) {
    const result = reducer(workspace, { type: 'ADD_PERSON', name: `Fictional ${stream}`,
      dob: '2005-01-01', owner: 'Jess Taylor', nextAction: 'Complete Client profile',
      reviewDate: TODAY, requestId: `stream-${stream}`, mvpProfile: true, programStream: stream });
    const person = result.people.find(item => item.registrationRequestId === `stream-${stream}`);
    assert.equal(person?.episodes[0]?.programStream, stream);
  }
});

test('a new profile can leave birth date and episode stream unassigned', () => {
  const workspace = createDefaultWorkspace();
  const result = reducer(workspace, { type: 'ADD_PERSON', name: 'Fictional Unassigned',
    dob: '', owner: 'Jess Taylor', nextAction: 'Complete Client profile',
    reviewDate: TODAY, requestId: 'unassigned-profile', mvpProfile: true, programStream: '' });
  const person = result.people.find(item => item.registrationRequestId === 'unassigned-profile');
  assert.equal(person?.dob, null);
  assert.equal(person?.episodes[0]?.programStream, '');
});
