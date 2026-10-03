import test from 'node:test';
import assert from 'node:assert/strict';
import { CLIENT_PROFILE_INSTRUMENTS, clientProfileBundle } from './clientProfileMeasure.js';
import { EP_BATCH_2_INSTRUMENTS, EP_BATCH_3_INSTRUMENTS } from './epCodebookInstruments.js';
import { INSTRUMENTS } from './instruments.js';
import { administrationMeasureBundles, instrumentVersionsForAdministrationMeasure } from './administrationMeasures.js';
import { createDefaultWorkspace, upgradeSampleData } from './model.js';

test('active instruments and measures contain only the current EP batches', () => {
  assert.deepEqual(INSTRUMENTS, [
    ...CLIENT_PROFILE_INSTRUMENTS, ...EP_BATCH_2_INSTRUMENTS, ...EP_BATCH_3_INSTRUMENTS,
  ]);
  const workspace = createDefaultWorkspace();
  const measures = administrationMeasureBundles(workspace.settings);
  assert.equal(measures.length, 5);
  const records = workspace.people.flatMap(person => person.episodes.flatMap(episode => episode.collections));
  const active = new Map(INSTRUMENTS.map(instrument => [instrument.version, instrument]));
  assert.ok(records.every(record => active.has(record.version)));
  assert.ok(records.filter(record => record.mvpTimepointId).every(record =>
    active.get(record.version).respondents.includes(record.respondent)));
  assert.deepEqual(measures.map(measure => instrumentVersionsForAdministrationMeasure(measure)), [
    CLIENT_PROFILE_INSTRUMENTS.map(item => item.version),
    EP_BATCH_2_INSTRUMENTS.map(item => item.version),
    EP_BATCH_2_INSTRUMENTS.map(item => item.version),
    EP_BATCH_3_INSTRUMENTS.map(item => item.version),
    EP_BATCH_3_INSTRUMENTS.map(item => item.version),
  ]);
  assert.ok(measures.filter(measure => measure.name.startsWith('90-day')).every(measure =>
    measure.respondent === 'Clinician'));
});

test('saved mock measure rules are retired from the active workspace', () => {
  const workspace = createDefaultWorkspace();
  workspace.settings.assessmentScheduleRules = [{ id: 'sample-bundle-start',
    name: 'Getting started with care', assessments: [{ version: 'Life and care check-in v1.0' }] }];
  assert.equal(administrationMeasureBundles(workspace.settings).length, 5);
  assert.deepEqual(upgradeSampleData(workspace).settings.assessmentScheduleRules, []);
  const previousProfile = { clientProfileBundle: { instrumentVersions: [
    ...CLIENT_PROFILE_INSTRUMENTS.map(item => item.version),
    'Client profile · Participation and contact v1.0',
  ] } };
  assert.deepEqual(clientProfileBundle(previousProfile).instrumentVersions,
    CLIENT_PROFILE_INSTRUMENTS.map(item => item.version));
});
