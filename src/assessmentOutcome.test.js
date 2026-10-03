import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultWorkspace, reducer, upgradeSampleData, TODAY } from './model.js';
import { ASSESSMENT_OUTCOME_OPTIONS, assessmentOutcomeRecord, initialAssessmentHasOutcomeStatus, initialAssessmentReadyForOutcome } from './assessmentOutcome.js';
import { derivedEpisodeStatus } from './batch1Registration.js';
import { peopleBundleSummary } from './people.js';
import { reconcileAssessmentSchedules } from './assessmentSchedules.js';
import { mvpInitialCompletionDate, mvpInitialBundles } from './mvpAssessmentPathway.js';

test('Oliver remains in Assessment after initial completion until a coded outcome is recorded', () => {
  const before = createDefaultWorkspace();
  const person = before.people.find(item => item.id === 'YS-1028');
  const episode = person.episodes[0];
  const record = assessmentOutcomeRecord(episode);
  assert.ok(record);
  assert.ok(initialAssessmentReadyForOutcome(episode, before.settings));
  assert.equal(episode.collections.filter(item => item.mvpInitialAssessment && item.mvpRespondent === 'Person')
    .every(item => item.response === 'Submitted'), true);
  assert.equal(derivedEpisodeStatus({}, episode, before.settings), 'Assessment');
  assert.equal(peopleBundleSummary({ person, episode, collection: record }, before.settings).status, 'Record outcome');
  assert.equal(mvpInitialCompletionDate(episode, before.settings), null);
  assert.equal(episode.collections.some(item => item.mvpTimepointId), false);
  const action = { type: 'RECORD_ASSESSMENT_OUTCOME', personId: person.id,
    episodeId: episode.id, outcome: ASSESSMENT_OUTCOME_OPTIONS[0] };
  const recorded = reducer(before, action);
  const updatedEpisode = recorded.people.find(item => item.id === person.id).episodes[0];
  assert.equal(updatedEpisode.assessmentOutcome.value, action.outcome);
  assert.equal(derivedEpisodeStatus({}, updatedEpisode, recorded.settings), 'Ongoing review');
  assert.equal(peopleBundleSummary({ person, episode: updatedEpisode, collection: assessmentOutcomeRecord(updatedEpisode) }, recorded.settings).status, 'Completed');
  assert.ok(mvpInitialCompletionDate(updatedEpisode, recorded.settings));
  assert.equal(updatedEpisode.collections.length, episode.collections.length);
  assert.equal(reducer(recorded, action), recorded);

  const changed = reducer(recorded, { ...action, outcome: ASSESSMENT_OUTCOME_OPTIONS[3] });
  const changedEpisode = changed.people.find(item => item.id === person.id).episodes[0];
  assert.equal(changedEpisode.assessmentOutcome.value, ASSESSMENT_OUTCOME_OPTIONS[3]);
  assert.equal(derivedEpisodeStatus({}, changedEpisode, changed.settings), 'Not proceed');
  assert.equal(mvpInitialCompletionDate(changedEpisode, changed.settings), null);

  const hidden = reducer(before, { type: 'SET_MVP_RECORD_ASSESSMENT_OUTCOME', enabled: false });
  assert.equal(reducer(hidden, action), hidden);
  assert.equal(derivedEpisodeStatus({}, episode, hidden.settings), 'Ongoing review');
  const restored = reducer(hidden, { type: 'APPLY_MVP_PRESET' });
  assert.equal(restored.settings.mvpRecordAssessmentOutcome, true);
});

test('outcome can be recorded at 0, 8, or all 17 responses; status waits for completion', () => {
  const before = createDefaultWorkspace();
  const person = before.people.find(item => item.id === 'YS-1028');
  const episode = person.episodes[0];
  const action = { type: 'RECORD_ASSESSMENT_OUTCOME', personId: person.id,
    episodeId: episode.id, outcome: ASSESSMENT_OUTCOME_OPTIONS[0] };
  for (const count of [0, 8]) {
    const incomplete = structuredClone(before);
    const records = incomplete.people.find(item => item.id === person.id).episodes[0].collections
      .filter(item => item.mvpInitialAssessment && item.mvpRespondent === 'Person');
    records.forEach((record, index) => { record.response = index < count ? 'Submitted' : 'Not started'; });
    assert.equal(initialAssessmentHasOutcomeStatus(incomplete.people.find(item => item.id === person.id).episodes[0], incomplete.settings), true);
    const saved = reducer(incomplete, action);
    const savedEpisode = saved.people.find(item => item.id === person.id).episodes[0];
    assert.equal(savedEpisode.assessmentOutcome.value, action.outcome);
    assert.equal(derivedEpisodeStatus({}, savedEpisode, saved.settings), 'Assessment');
    assert.equal(mvpInitialCompletionDate(savedEpisode, saved.settings), null);
    const stopped = reducer(incomplete, { ...action, outcome: ASSESSMENT_OUTCOME_OPTIONS[8] });
    const stoppedEpisode = stopped.people.find(item => item.id === person.id).episodes[0];
    assert.equal(derivedEpisodeStatus({}, stoppedEpisode, stopped.settings), 'Not proceed');
    assert.ok(stoppedEpisode.collections.some(item => item.mvpInitialAssessment &&
      item.mvpRespondent === 'Person' && item.response !== 'Submitted'));
    assert.equal(mvpInitialCompletionDate(stoppedEpisode, stopped.settings), null);
  }
  assert.equal(initialAssessmentReadyForOutcome(episode, before.settings), true);

  const noTransition = structuredClone(before);
  noTransition.settings.mvpInitialBundles = mvpInitialBundles(noTransition.settings)
    .map(bundle => bundle.programStream === 'Psychosis' ? { ...bundle, statusChange: 'Assessment' } : bundle);
  assert.equal(initialAssessmentReadyForOutcome(episode, noTransition.settings), false);
  assert.equal(reducer(noTransition, action), noTransition);
  assert.equal(derivedEpisodeStatus({}, episode, noTransition.settings), 'Assessment');
});

test('recording a Psychosis outcome also updates the existing Batch 2 instrument', () => {
  const before = createDefaultWorkspace();
  const person = before.people.find(item => item.id === 'YS-1028');
  const episode = person.episodes[0];
  const record = assessmentOutcomeRecord(episode);
  assert.ok(record);
  const outcome = ASSESSMENT_OUTCOME_OPTIONS[4];
  const after = reducer(before, { type: 'RECORD_ASSESSMENT_OUTCOME', personId: person.id,
    episodeId: episode.id, outcome });
  const saved = after.people.find(item => item.id === person.id).episodes[0];
  assert.equal(saved.assessmentOutcome.value, outcome);
  assert.equal(assessmentOutcomeRecord(saved).answers[0], outcome);
  assert.equal(assessmentOutcomeRecord(saved).response, 'Submitted');
  assert.equal(assessmentOutcomeRecord(saved).submittedAt, record.submittedAt);
});

test('older saved fictional streams reclassify without duplicating their measures', () => {
  const before = createDefaultWorkspace();
  const episode = before.people.find(item => item.id === 'YS-1034').episodes[0];
  episode.programStream = 'General';
  for (const period of episode.carePeriods || []) period.programStream = 'General';
  for (const record of episode.collections) {
    if (record.bundleContext?.programStream === 'Mood') record.bundleContext.programStream = 'General';
    if (record.mvpInitialBundleDefinitionId)
      record.mvpInitialBundleDefinitionId = record.mvpInitialBundleDefinitionId.replace('MOOD', 'GENERAL');
    if (record.mvpBundleDefinitionId)
      record.mvpBundleDefinitionId = record.mvpBundleDefinitionId.replace('MOOD', 'GENERAL');
  }
  const originalIds = episode.collections.map(record => record.id);
  const migrated = reconcileAssessmentSchedules(upgradeSampleData(before), TODAY)
    .people.find(item => item.id === 'YS-1034').episodes[0];
  assert.equal(migrated.programStream, 'Mood');
  assert.equal(migrated.carePeriods[0].programStream, 'Mood');
  assert.deepEqual(migrated.collections.map(record => record.id), originalIds);
  assert.ok(migrated.collections.every(record => record.bundleContext?.programStream !== 'General'));
});
