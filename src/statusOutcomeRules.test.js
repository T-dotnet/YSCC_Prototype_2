import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultWorkspace, reducer } from './model.js';
import { ASSESSMENT_OUTCOME_OPTIONS, visibleAssessmentOutcomeOptions } from './assessmentOutcome.js';
import { completedStatusTransitions } from './measureStatusChange.js';
import { sharedStatusOutcomeOptions, statusOutcomeRuleFor, statusOutcomeRules } from './statusOutcomeRules.js';

test('Profiling to Assessment defaults on with every outcome shown', () => {
  const original = createDefaultWorkspace();
  const rule = statusOutcomeRuleFor(original.settings, 'Profiling', 'Assessment');
  assert.equal(rule.enabled, true);
  assert.deepEqual(rule.options, ASSESSMENT_OUTCOME_OPTIONS.map(value => ({ value, visible: true })));
  const emptyLegacy = reducer(original, { type: 'SAVE_STATUS_OUTCOME_RULE', rule: {
    ...rule, enabled: false, options: sharedStatusOutcomeOptions(),
  } });
  assert.equal(statusOutcomeRuleFor(emptyLegacy.settings, 'Profiling', 'Assessment').enabled, true);
  assert.equal(statusOutcomeRuleFor(emptyLegacy.settings, 'Profiling', 'Assessment')
    .options.every(option => option.visible), true);
  const saved = reducer(original, { type: 'SAVE_STATUS_OUTCOME_RULE', rule: {
    ...rule, enabled: false,
  } });
  assert.equal(statusOutcomeRuleFor(saved.settings, 'Profiling', 'Assessment').enabled, false);
});

test('a custom status pair controls its dropdown choices and records an outcome on its completed measure', () => {
  const original = createDefaultWorkspace();
  const person = original.people.find(item => item.id === 'YS-1028');
  const episode = person.episodes[0];
  const transition = completedStatusTransitions(episode, original.settings).find(item =>
    item.from === 'Profiling' && item.to === 'Assessment');
  assert.ok(transition);

  const rule = { from: 'Profiling', to: 'Assessment', enabled: true,
    options: sharedStatusOutcomeOptions([{ value: ASSESSMENT_OUTCOME_OPTIONS[0], visible: true }]) };
  const configured = reducer(original, { type: 'SAVE_STATUS_OUTCOME_RULE', rule });
  assert.deepEqual(statusOutcomeRuleFor(configured.settings, rule.from, rule.to), { ...rule, mandatory: true });
  assert.deepEqual(statusOutcomeRules(configured.settings).map(item => item.options.map(option => option.value)),
    [ASSESSMENT_OUTCOME_OPTIONS, ASSESSMENT_OUTCOME_OPTIONS, ASSESSMENT_OUTCOME_OPTIONS]);
  assert.deepEqual(statusOutcomeRules(configured.settings).map(item => `${item.from} → ${item.to}`), [
    'Profiling → Assessment', 'Assessment → Ongoing review', 'Ongoing review → Ongoing review',
  ]);
  assert.equal(reducer(configured, { type: 'SAVE_STATUS_OUTCOME_RULE', rule: {
    ...rule, options: sharedStatusOutcomeOptions(),
  } }), configured);

  const action = { type: 'RECORD_STATUS_TRANSITION_OUTCOME', personId: person.id,
    episodeId: episode.id, recordId: transition.recordId, from: rule.from, to: rule.to };
  assert.equal(reducer(configured, { ...action, outcome: ASSESSMENT_OUTCOME_OPTIONS[1] }), configured);
  const recorded = reducer(configured, { ...action, outcome: ASSESSMENT_OUTCOME_OPTIONS[0] });
  assert.equal(recorded.people.find(item => item.id === person.id).episodes[0]
    .statusOutcomes[0].value, ASSESSMENT_OUTCOME_OPTIONS[0]);
  assert.equal(reducer(recorded, { ...action, outcome: ASSESSMENT_OUTCOME_OPTIONS[0] }), recorded);

  const disabled = reducer(recorded, { type: 'SAVE_STATUS_OUTCOME_RULE',
    rule: { ...rule, enabled: false } });
  assert.equal(reducer(disabled, { ...action, outcome: ASSESSMENT_OUTCOME_OPTIONS[1] }), disabled);
  const removed = reducer(disabled, { type: 'DELETE_STATUS_OUTCOME_RULE',
    from: rule.from, to: rule.to });
  assert.equal(removed, disabled);
  assert.equal(removed.people.find(item => item.id === person.id).episodes[0]
    .statusOutcomes[0].value, ASSESSMENT_OUTCOME_OPTIONS[0]);
});

test('Ongoing review can transition to itself and remains a required final setting', () => {
  const original = createDefaultWorkspace();
  const rule = { from: 'Ongoing review', to: 'Ongoing review', enabled: true,
    options: sharedStatusOutcomeOptions([{ value: ASSESSMENT_OUTCOME_OPTIONS[0], visible: true }]) };
  const configured = reducer(original, { type: 'SAVE_STATUS_OUTCOME_RULE', rule });
  assert.notEqual(configured, original);
  assert.equal(statusOutcomeRuleFor(configured.settings, rule.from, rule.to).mandatory, true);
  assert.equal(statusOutcomeRules(configured.settings).at(-1).to, 'Ongoing review');
  assert.equal(reducer(configured, { type: 'DELETE_STATUS_OUTCOME_RULE',
    from: rule.from, to: rule.to }), configured);

  const episode = { collections: [
    { id: 'first', response: 'Submitted', submittedAt: '2026-01-01', bundleContext: { statusChange: 'Ongoing review' } },
    { id: 'second', response: 'Submitted', submittedAt: '2026-02-01', bundleContext: { statusChange: 'Ongoing review' } },
  ] };
  assert.deepEqual(completedStatusTransitions(episode, configured.settings).map(item =>
    `${item.from} → ${item.to}`), ['Assessment → Ongoing review', 'Ongoing review → Ongoing review']);
});

test('coded assessment outcome options can be hidden without changing existing values', () => {
  const original = createDefaultWorkspace();
  const person = original.people.find(item => item.id === 'YS-1028');
  const episode = person.episodes[0];
  const selected = [ASSESSMENT_OUTCOME_OPTIONS[0]];
  const savedConfig = reducer(original, { type: 'SAVE_ASSESSMENT_OUTCOME_CONFIG',
    enabled: false, options: selected });
  assert.equal(savedConfig.settings.mvpRecordAssessmentOutcome, false);
  assert.deepEqual(visibleAssessmentOutcomeOptions(savedConfig.settings), selected);
  const configured = reducer(original, { type: 'SET_ASSESSMENT_OUTCOME_OPTIONS', options: selected });
  assert.deepEqual(visibleAssessmentOutcomeOptions(configured.settings), selected);
  assert.equal(reducer(configured, { type: 'RECORD_ASSESSMENT_OUTCOME',
    personId: person.id, episodeId: episode.id, outcome: ASSESSMENT_OUTCOME_OPTIONS[1] }), configured);
  assert.equal(reducer(configured, { type: 'SET_ASSESSMENT_OUTCOME_OPTIONS', options: [] }), configured);
  const recorded = reducer(original, { type: 'RECORD_ASSESSMENT_OUTCOME',
    personId: person.id, episodeId: episode.id, outcome: ASSESSMENT_OUTCOME_OPTIONS[1] });
  const narrowed = reducer(recorded, { type: 'SET_ASSESSMENT_OUTCOME_OPTIONS', options: selected });
  assert.equal(narrowed.people.find(item => item.id === person.id).episodes[0]
    .assessmentOutcome.value, ASSESSMENT_OUTCOME_OPTIONS[1]);
});
