import test from 'node:test';
import assert from 'node:assert/strict';
import { CLIENT_PROFILE_INSTRUMENTS, clientProfileBundle } from './clientProfileMeasure.js';
import { EP_BATCH_2_INSTRUMENTS, EP_BATCH_3_INSTRUMENTS } from './epCodebookInstruments.js';
import { CLINICIAN_REVIEW_INSTRUMENT, INSTRUMENTS, MVP_STREAM_QUESTIONNAIRES, getInstrument } from './instruments.js';
import { PROGRAM_STREAMS } from './carePeriods.js';
import { administrationMeasureBundles, instrumentVersionsForAdministrationMeasure } from './administrationMeasures.js';
import { createDefaultWorkspace, upgradeSampleData } from './model.js';

test('active instruments distinguish current EP batches from fictional stream check-ins', () => {
  assert.deepEqual(INSTRUMENTS, [
    ...CLIENT_PROFILE_INSTRUMENTS, ...EP_BATCH_2_INSTRUMENTS, ...EP_BATCH_3_INSTRUMENTS,
    ...PROGRAM_STREAMS.filter(stream => stream !== 'Psychosis').map(stream => MVP_STREAM_QUESTIONNAIRES[stream]),
    CLINICIAN_REVIEW_INSTRUMENT,
  ]);
  const workspace = createDefaultWorkspace();
  const measures = administrationMeasureBundles(workspace.settings);
  assert.equal(measures.length, 1 + PROGRAM_STREAMS.length * 2);
  const records = workspace.people.flatMap(person => person.episodes.flatMap(episode => episode.collections));
  const active = new Map(INSTRUMENTS.map(instrument => [instrument.version, instrument]));
  assert.ok(records.every(record => getInstrument(record.version)));
  assert.ok(records.filter(record => record.mvpTimepointId || record.clientProfileMeasure)
    .every(record => active.has(record.version)));
  assert.ok(records.filter(record => record.mvpTimepointId).every(record =>
    active.get(record.version).respondents.includes(record.respondent)));
  assert.deepEqual(measures.map(measure => instrumentVersionsForAdministrationMeasure(measure)), [
    CLIENT_PROFILE_INSTRUMENTS.map(item => item.version),
    ...PROGRAM_STREAMS.map(stream => stream === 'Psychosis'
      ? EP_BATCH_2_INSTRUMENTS.map(item => item.version) : [MVP_STREAM_QUESTIONNAIRES[stream].version]),
    ...PROGRAM_STREAMS.map(stream => stream === 'Psychosis'
      ? EP_BATCH_3_INSTRUMENTS.map(item => item.version) : [CLINICIAN_REVIEW_INSTRUMENT.version]),
  ]);
  assert.ok(measures.filter(measure => measure.name.startsWith('90-day')).every(measure =>
    measure.respondent === 'Clinician'));
});

test('saved mock measure rules are retired from the active workspace', () => {
  const workspace = createDefaultWorkspace();
  workspace.settings.assessmentScheduleRules = [{ id: 'sample-bundle-start',
    name: 'Getting started with care', assessments: [{ version: 'Life and care check-in v1.0' }] }];
  assert.equal(administrationMeasureBundles(workspace.settings).length, 1 + PROGRAM_STREAMS.length * 2);
  assert.deepEqual(upgradeSampleData(workspace).settings.assessmentScheduleRules, []);
  const previousProfile = { clientProfileBundle: { instrumentVersions: [
    ...CLIENT_PROFILE_INSTRUMENTS.map(item => item.version),
    'Client profile · Participation and contact v1.0',
  ] } };
  assert.deepEqual(clientProfileBundle(previousProfile).instrumentVersions,
    CLIENT_PROFILE_INSTRUMENTS.map(item => item.version));
});
