import test from 'node:test';
import assert from 'node:assert/strict';
import { mvpBattery, mvpPathwayEnabled, mvpClinicianCreationEnabled, mvpBundleEditingEnabled, mvpReviewBundles, mvpReviewItems, mvpReviewNumbers, reconcileMvpAssessmentPathway, MVP_INITIAL_BUNDLE, MVP_INITIAL_BUNDLES, mvpInitialBundles, makeInitialAssessmentsImmediate } from './mvpAssessmentPathway.js';
import { assessmentBundleGroups } from './assessmentBundles.js';
import { createSeed, createDefaultWorkspace, reducer, upgradeSampleData } from './model.js';
import { getNotifications } from './notifications.js';
import { getInstrument, questionnaireState } from './instruments.js';
import { careEventEntries } from './activity.js';

const today = '2026-03-25';
const episode = () => ({ id: 'E', status: 'Active', start: '2026-01-01', programStream: 'General',
  carePeriods: [{ startDate: '2026-01-01', endDateExclusive: null, programStream: 'General', careLevel: 'Mid' }],
  events: [], collections: [] });
const fixture = () => ({ settings: { advancedAssessmentOptions: false, assessmentSms: false },
  people: [{ id: 'P', name: 'Example Person', family: 'Family Member', episodes: [episode()] }] });

test('review numbers advance by timepoint and match across respondents', () => {
  const numbers = mvpReviewNumbers({ collections: [
    { mvpTimepointId: 'review-2', due: '2026-07-01', mvpRespondent: 'Clinician' },
    { mvpTimepointId: 'review-1', due: '2026-04-01', mvpRespondent: 'Person' },
    { mvpInitialAssessment: true, due: '2026-01-01' },
    { mvpTimepointId: 'review-2', due: '2026-07-01', mvpRespondent: 'Person' },
    { mvpTimepointId: 'review-1', due: '2026-04-01', mvpRespondent: 'Clinician' },
  ] });
  assert.deepEqual([...numbers], [['review-1', 1], ['review-2', 2]]);
});

test('fresh sample workspace uses the requested MVP settings', () => {
  const settings = createDefaultWorkspace().settings;
  assert.equal(settings.showGeneralReport,true);
  assert.equal(settings.advancedAssessmentOptions,false);
  assert.equal(mvpClinicianCreationEnabled(settings),false);
  assert.equal(mvpBundleEditingEnabled(settings),false);
  assert.equal(mvpPathwayEnabled(settings),true);
  assert.equal(settings.mvpReviewHighlight,false);
  assert.deepEqual(reducer(createSeed(),{type:'RESET'}).settings,settings);
  const reviews = mvpReviewBundles(settings);
  assert.equal(reviews.length, 8);
  assert.equal(new Set(reviews.map(bundle => bundle.id)).size, 8);
  assert.equal(reviews.filter(bundle => bundle.name.startsWith('90-day review · Young person')).length, 4);
  assert.equal(reviews.filter(bundle => bundle.name.startsWith('90-day review · Clinician')).length, 4);
});

test('MVP can save and remove an admin assessment bundle without changing its review pathway', () => {
  const mvp = reducer(createSeed(), { type: 'SET_ADVANCED_ASSESSMENT_OPTIONS', enabled: false });
  const rule = { id: 'MVP-CUSTOM', name: 'Custom review', enabled: true, trigger: 'current',
    programStream: 'All', careLevel: 'All', timing: 'days', after: 'intake', days: 28,
    repeat: true, channel: 'Clinician entry', recipient: 'Person', assessments: [
      { id: 'one', version: 'Initial assessment v1.0', requirement: 'Mandatory' },
    ] };
  const saved = reducer(mvp, { type: 'SAVE_ASSESSMENT_SCHEDULE_RULE', rule });
  assert.equal(saved.settings.assessmentScheduleRules.some(item => item.id === rule.id), true);
  assert.equal(saved.settings.automaticAssessmentDueDates, false);
  const removed = reducer(saved, { type: 'DELETE_ASSESSMENT_SCHEDULE_RULE', id: rule.id });
  assert.equal(removed.settings.assessmentScheduleRules.some(item => item.id === rule.id), false);
});

test('initial assessment editor settings save and appear in the bundle configuration', () => {
  const before = reducer(createSeed(), { type: 'SET_ADVANCED_ASSESSMENT_OPTIONS', enabled: false });
  const saved = reducer(before, { type: 'SAVE_MVP_INITIAL_BUNDLE', bundle: {
    ...MVP_INITIAL_BUNDLES[0], channel: 'Clinician entry',
  } });
  assert.notEqual(saved, before);
  assert.equal(mvpInitialBundles(saved.settings).length, 4);
  assert.equal(mvpInitialBundles(saved.settings).find(item => item.id === MVP_INITIAL_BUNDLES[0].id).channel, 'Clinician entry');
  assert.equal(mvpInitialBundles(saved.settings).find(item => item.id === MVP_INITIAL_BUNDLES[1].id).channel, 'Clinic tablet');
  const deleted = reducer(saved, { type: 'DELETE_MVP_INITIAL_BUNDLE', id: MVP_INITIAL_BUNDLES[0].id });
  assert.equal(mvpInitialBundles(deleted.settings).length, 3);
});

test('combined initial bundle settings expand into independent stream bundles', () => {
  const bundles = mvpInitialBundles({ mvpInitialBundle: { ...MVP_INITIAL_BUNDLE,
    channel: 'Clinician entry', delayDays: 3,
    assessmentsByStream: { General: ['Initial assessment v1.0'] },
  } });
  assert.equal(bundles.length, 4);
  assert.equal(new Set(bundles.map(bundle => bundle.id)).size, 4);
  assert.equal(bundles.find(bundle => bundle.programStream === 'General').name, 'Initial assessment · Young person · General');
  assert.deepEqual(bundles.find(bundle => bundle.programStream === 'General').assessmentsByStream.General,
    ['Initial assessment v1.0']);
  assert.ok(bundles.every(bundle => bundle.channel === 'Clinician entry' && bundle.delayDays === 3));
});

test('saved initial assessment schedules become immediate once across every stream', () => {
  const state = { settings: {
    mvpInitialBundle: { ...MVP_INITIAL_BUNDLE, delayDays: 3 },
    mvpInitialBundles: MVP_INITIAL_BUNDLES.map(bundle => ({ ...bundle, delayDays: 3 })),
  } };
  const updated = makeInitialAssessmentsImmediate(state);
  assert.equal(updated.settings.mvpInitialBundle.delayDays, 0);
  assert.ok(mvpInitialBundles(updated.settings).every(bundle => bundle.delayDays === 0));
  assert.equal(makeInitialAssessmentsImmediate(updated), updated);
});

test('initial bundle timing and instrument edits affect new records and preserve existing ones', () => {
  const configured = { ...fixture(), settings: { ...fixture().settings, mvpInitialBundle: {
    ...MVP_INITIAL_BUNDLE, delayDays: 7, channel: 'Clinician entry',
    assessmentsByStream: { General: ['Initial assessment v1.0'] },
  } } };
  const first = reconcileMvpAssessmentPathway(configured, today);
  const records = first.people[0].episodes[0].collections.filter(record => record.mvpInitialAssessment);
  const person = records.filter(record => record.mvpRespondent === 'Person');
  assert.equal(person.length, 1);
  assert.equal(person[0].due, '2026-01-08');
  assert.equal(person[0].channel, 'Clinician entry');
  assert.equal(person[0].version, 'Initial assessment v1.0');
  const changedSettings = { ...first, settings: { ...first.settings,
    mvpInitialBundle: { ...first.settings.mvpInitialBundle, delayDays: 14 } } };
  const next = reconcileMvpAssessmentPathway(changedSettings, today);
  assert.equal(next.people[0].episodes[0].collections.find(record => record.id === person[0].id).due, '2026-01-08');
});

test('older two review definitions expand into separate stream bundles', () => {
  const bundles = mvpReviewBundles({ mvpReviewBundles: [
    { id: 'MVP-REVIEW-PERSON', name: '90-day review · Young person', respondent: 'Person', channel: 'Clinician entry', enabled: true },
    { id: 'MVP-REVIEW-FAMILY', name: '90-day review · Family', respondent: 'Family respondent', channel: 'Clinic tablet', enabled: true },
  ] });
  assert.equal(bundles.length, 8);
  assert.equal(new Set(bundles.map(bundle => bundle.id)).size, 8);
  assert.equal(bundles.filter(bundle => bundle.channel === 'Clinician entry').length, 8);
  assert.deepEqual(new Set(bundles.map(bundle => bundle.respondent)), new Set(['Person', 'Clinician']));
  assert.ok(bundles.every(bundle => bundle.programStream !== 'All'));
});

test('MVP creates two mandatory respondent bundles for one scheduled timepoint', () => {
  const before = fixture();
  const next = reconcileMvpAssessmentPathway(before, today);
  const allRecords = next.people[0].episodes[0].collections;
  const records = allRecords.filter(record => record.mvpTimepointId);
  const initial = allRecords.filter(record => record.mvpInitialAssessment);
  assert.equal(allRecords.length, 34);
  assert.equal(initial.length, 18);
  assert.equal(new Set(initial.map(record => record.bundleId)).size, 2);
  assert.ok(initial.every(record => record.due === '2026-01-01' && record.bundleRequirement === 'Mandatory'));
  assert.equal(records.length, 16);
  assert.equal(new Set(records.map(record => record.due)).size, 1);
  assert.equal(records[0].due, '2026-04-01');
  assert.equal(new Set(records.map(record => record.mvpTimepointId)).size, 1);
  assert.equal(new Set(records.map(record => record.bundleId)).size, 2);
  assert.deepEqual(new Set(records.map(record => record.respondent)), new Set(['Person', 'Clinician']));
  assert.ok(records.every(record => record.bundleRequirement === 'Mandatory'));
  assert.equal(assessmentBundleGroups(next.people[0].episodes[0], records).length, 2);
  assert.equal(next.people[0].episodes[0].events[0].actionType, 'SCHEDULE_MVP_REVIEW');
  assert.ok(mvpBattery('General', 'Person').length > 0);
  assert.equal(reconcileMvpAssessmentPathway(next, today), next);
  assert.equal(before.people[0].episodes[0].collections.length, 0);
});

test('Administration review bundle edits drive future scheduled records and deletion retains history', () => {
  const original = fixture();
  const family = mvpReviewBundles(original.settings).find(bundle => bundle.respondent === 'Clinician');
  const edited = reducer(original, { type: 'SAVE_MVP_REVIEW_BUNDLE', bundle: {
    ...family, name: 'Clinician 90-day check-in', channel: 'Clinician entry',
  } });
  assert.equal(mvpReviewBundles(edited.settings).find(bundle => bundle.id === family.id).name, 'Clinician 90-day check-in');
  const scheduled = reconcileMvpAssessmentPathway(edited, today);
  const familyRecords = scheduled.people[0].episodes[0].collections.filter(record => record.mvpTimepointId && record.respondent === 'Clinician');
  assert.equal(familyRecords.length, 1);
  assert.ok(familyRecords.every(record => record.bundleName === 'Clinician 90-day check-in' && record.channel === 'Clinician entry'));
  const deleted = reducer(scheduled, { type: 'DELETE_MVP_REVIEW_BUNDLE', id: family.id });
  assert.equal(mvpReviewBundles(deleted.settings).some(bundle => bundle.id === family.id), false);
  assert.deepEqual(deleted.people, scheduled.people);
  assert.equal(reducer(deleted, { type: 'DELETE_MVP_REVIEW_BUNDLE', id: family.id }), deleted);
  const restored = reducer(deleted, { type: 'SAVE_MVP_REVIEW_BUNDLE', bundle: family });
  assert.equal(mvpReviewBundles(restored.settings).some(bundle => bundle.id === family.id), true);
});

test('disabled MVP review bundle does not create new scheduled records', () => {
  const original = fixture();
  const family = mvpReviewBundles(original.settings).find(bundle => bundle.respondent === 'Clinician');
  const disabled = reducer(original, { type: 'SAVE_MVP_REVIEW_BUNDLE', bundle: {...family, enabled: false} });
  const records = disabled.people[0].episodes[0].collections.filter(record => record.mvpTimepointId);
  assert.equal(records.length, 15);
  assert.ok(records.every(record => record.respondent === 'Person'));
  const prior = reconcileMvpAssessmentPathway(original, today);
  prior.people[0].episodes[0].collections.filter(record => record.mvpTimepointId && record.respondent === 'Person')
    .forEach(record => { record.response = 'Submitted'; });
  const afterDisable = reducer(prior, { type: 'SAVE_MVP_REVIEW_BUNDLE', bundle: {...family, enabled: false} });
  const next = reconcileMvpAssessmentPathway(afterDisable, '2026-04-02');
  assert.equal(next.people[0].episodes[0].collections.filter(record => record.mvpTimepointId && record.respondent === 'Person').length, 30);
  assert.equal(next.people[0].episodes[0].collections.filter(record => record.mvpTimepointId && record.respondent === 'Clinician').length, 1);
});

test('review bundle cadence, respondent, and instruments are used for future reviews', () => {
  const original = fixture();
  const young = mvpReviewBundles(original.settings).find(bundle => bundle.programStream === 'General' && bundle.respondent === 'Clinician');
  const version = 'Clinician care review v1.0';
  const edited = { ...young, days: 30,
    assessments: [{ id: 'clinician-review', version, requirement: 'Mandatory' }] };
  const saved = reducer(original, { type: 'SAVE_MVP_REVIEW_BUNDLE', bundle: edited });
  assert.equal(mvpReviewItems(mvpReviewBundles(saved.settings).find(bundle => bundle.id === young.id)).length, 1);
  const records = saved.people[0].episodes[0].collections.filter(record => record.mvpBundleDefinitionId === young.id);
  assert.equal(records.length, 1);
  assert.equal(records[0].due, '2026-01-31');
  assert.equal(records[0].respondent, 'Clinician');
  assert.equal(records[0].version, version);
  assert.equal(records[0].mvpRespondent, 'Clinician');
});

test('review bundle date and age conditions gate one-off scheduling', () => {
  const original = fixture();
  original.people[0].dob = '2010-03-25';
  const family = mvpReviewBundles(original.settings).find(bundle => bundle.programStream === 'General' && bundle.respondent === 'Clinician');
  const edited = { ...family, timing: 'date', dueDate: '2026-05-01', repeat: false, minAge: 18 };
  const excluded = reducer(original, { type: 'SAVE_MVP_REVIEW_BUNDLE', bundle: edited });
  assert.equal(excluded.people[0].episodes[0].collections.some(record => record.mvpBundleDefinitionId === family.id), false);
  const included = reducer(excluded, { type: 'SAVE_MVP_REVIEW_BUNDLE', bundle: { ...edited, minAge: 12 } });
  const records = included.people[0].episodes[0].collections.filter(record => record.mvpBundleDefinitionId === family.id);
  assert.equal(records.length, 1);
  assert.ok(records.every(record => record.due === '2026-05-01'));
  records.forEach(record => { record.response = 'Submitted'; });
  assert.equal(reconcileMvpAssessmentPathway(included, '2026-05-02'), included);
});

test('MVP pathway switch stops new scheduling and reminders while retaining records', () => {
  const before = fixture();
  assert.equal(mvpPathwayEnabled(before.settings),true);
  const scheduled = reconcileMvpAssessmentPathway(before,today);
  const off = reducer(scheduled,{type:'SET_MVP_ASSESSMENT_PATHWAY',enabled:false});
  assert.equal(mvpPathwayEnabled(off.settings),false);
  assert.deepEqual(off.people,scheduled.people);
  assert.equal(reconcileMvpAssessmentPathway(off,'2026-09-30'),off);
  assert.equal(getNotifications(off,today).some(item=>item.category==='scheduled_review'),false);
  const on = reducer(off,{type:'SET_MVP_ASSESSMENT_PATHWAY',enabled:true});
  assert.equal(mvpPathwayEnabled(on.settings),true);
  assert.equal(reducer(on,{type:'SET_MVP_ASSESSMENT_PATHWAY',enabled:true}),on);
});

test('MVP holds the next cycle until both bundles are complete and preserves old records', () => {
  const before = fixture();
  before.people[0].episodes[0].collections.push({ id: 'prior', response: 'Submitted', answers: ['saved'] });
  const first = reconcileMvpAssessmentPathway(before, today);
  const pending = first.people[0].episodes[0].collections.filter(record => record.mvpTimepointId);
  pending.filter(record => record.respondent === 'Person').forEach(record => { record.response = 'Submitted'; });
  assert.equal(reconcileMvpAssessmentPathway(first, '2026-04-02'), first);
  pending.filter(record => record.respondent === 'Clinician').forEach(record => { record.response = 'Submitted'; });
  const next = reconcileMvpAssessmentPathway(first, '2026-04-02');
  assert.equal(next.people[0].episodes[0].collections.filter(record => record.mvpTimepointId).length, 32);
  assert.equal(next.people[0].episodes[0].collections.at(-1).due, '2026-06-30');
  assert.deepEqual(next.people[0].episodes[0].collections[0].answers, ['saved']);
});

test('MVP can add a missing family respondent before collection', () => {
  const state = reducer(createSeed(), { type: 'SET_ADVANCED_ASSESSMENT_OPTIONS', enabled: false });
  const person = state.people.find(item => item.id === 'YS-1034');
  const episode = person.episodes.find(item => item.id === 'EP-1034-01');
  person.family = null;
  assert.equal(person.family, null);
  const action = { type: 'SET_MVP_FAMILY_RESPONDENT', personId: person.id,
    episodeId: episode.id, name: '  Example Family  ' };
  const changed = reducer(state, action);
  assert.equal(changed.people.find(item => item.id === person.id).family, 'Example Family');
  assert.equal(reducer(changed, action), changed);
  assert.equal(reducer(state, { ...action, name: ' ' }), state);
});

test('settings switch keeps the flexible configuration and changes an entire MVP bundle method', () => {
  const original = createSeed();
  const switched = reducer(original, { type: 'RESET' });
  const tableMode = reducer(switched, { type: 'SET_MVP_REVIEW_HIGHLIGHT', enabled: false });
  assert.equal(tableMode.settings.mvpReviewHighlight, false);
  assert.deepEqual(tableMode.people, switched.people);
  assert.equal(reducer(original, { type: 'SET_MVP_REVIEW_HIGHLIGHT', enabled: false }), original);
  const person = switched.people.find(item => item.id === 'YS-1024');
  const episode = person.episodes.find(item => item.id === 'EP-1024-01');
  const bundle = episode.collections.find(record => record.mvpTimepointId && record.mvpRespondent === 'Person');
  assert.ok(bundle);
  const changed = reducer(switched, { type: 'SET_MVP_BUNDLE_METHOD', personId: person.id,
    episodeId: episode.id, bundleId: bundle.bundleId, channel: 'Clinician entry' });
  assert.deepEqual(new Set(changed.people.find(item => item.id === person.id).episodes.find(item => item.id === episode.id)
    .collections.filter(record => record.bundleId === bundle.bundleId).map(record => record.channel)), new Set(['Clinician entry']));
  const opened = reducer(changed, { type: 'DELIVER', personId: person.id, episodeId: episode.id,
    collectionId: bundle.id, channel: 'Clinician entry', respondent: 'Person', assistance: 'Transcribed' });
  const revised = reducer(opened, { type: 'SET_MVP_BUNDLE_METHOD', personId: person.id,
    episodeId: episode.id, bundleId: bundle.bundleId, channel: 'Clinic tablet' });
  const revisedBundle = revised.people.find(item => item.id === person.id).episodes.find(item => item.id === episode.id)
    .collections.filter(record => record.bundleId === bundle.bundleId);
  assert.ok(revisedBundle.every(record => record.channel === 'Clinic tablet'));
  assert.equal(revisedBundle[0].attempts.at(-1).status, 'Collection method changed');
  assert.ok(revisedBundle[0].attempts.at(-1).endedAt);
  assert.equal(revisedBundle[0].assignment, 'Planned');
  assert.equal(revisedBundle[0].link, 'Not sent');
  revisedBundle[0].response = 'Draft';
  assert.equal(reducer(revised, { type: 'SET_MVP_BUNDLE_METHOD', personId: person.id,
    episodeId: episode.id, bundleId: bundle.bundleId, channel: 'SMS link' }), revised);
  const manualAction = { type: 'CREATE_ASSESSMENT_BUNDLE', personId: person.id, episodeId: episode.id,
    id: 'MVP-BLANK-TEST', name: 'One-off event assessment', bundleId: 'blank',
    optionalIds: [], assessmentOverrides: [], extraAssessments: [], due: '', statusChange: 'Ongoing review',
    blankVersions:['90-day review v1.0','General stream check-in v1.0'], blankRespondent:'Person', blankChannel:'Clinic tablet' };
  assert.equal(reducer(changed, manualAction), changed);
  const creationEnabled = reducer(changed, {type:'SET_MVP_CLINICIAN_CREATION',enabled:true});
  const manuallyCreated = reducer(creationEnabled, manualAction);
  const manualRecords = manuallyCreated.people.find(item => item.id === person.id).episodes.find(item => item.id === episode.id)
    .collections.filter(record => record.mvpCreatedAssessment);
  assert.equal(manualRecords.length, 2);
  assert.ok(manualRecords.every(record => record.bundleRequirement === 'Mandatory' && record.bundleName === 'One-off event assessment'));
  assert.ok(manualRecords.every(record => record.bundleContext.statusChange === 'Ongoing review'));
  assert.equal(new Set(manualRecords.map(record => record.bundleId)).size, 1);
  assert.deepEqual(new Set(manualRecords.map(record => record.respondent)), new Set(['Person']));
  assert.deepEqual(new Set(manualRecords.map(record => record.channel)), new Set(['Clinic tablet']));
  assert.equal(manuallyCreated.people.find(item => item.id === person.id).episodes.find(item => item.id === episode.id)
    .collections.filter(record => record.mvpTimepointId).length, episode.collections.filter(record => record.mvpTimepointId).length);
  assert.equal(reducer(changed, { ...manualAction, id: 'MVP-EXTRA-TEST',
    extraAssessments: [{id:'extra',version:'Demo check-in v1.0',requirement:'Optional'}] }), changed);
  assert.equal(reducer(changed, {...manualAction, blankVersions:[]}), changed);
  assert.equal(reducer(changed, {...manualAction, bundleId:'sample-bundle-start'}), changed);
  assert.equal(reducer(changed, { type: 'PLAN', personId: person.id, episodeId: episode.id }), changed);
  const restored = reducer(changed, { type: 'SET_ADVANCED_ASSESSMENT_OPTIONS', enabled: true });
  assert.deepEqual(restored.settings.assessmentScheduleRules, switched.settings.assessmentScheduleRules);
  assert.equal(restored.people.find(item => item.id === person.id).episodes.find(item => item.id === episode.id)
    .collections.filter(record => record.mvpTimepointId).length, episode.collections.filter(record => record.mvpTimepointId).length);
  const reloaded = upgradeSampleData(structuredClone(changed));
  const reloadedRecords = reloaded.people.find(item => item.id === person.id).episodes.find(item => item.id === episode.id)
    .collections.filter(record => record.mvpTimepointId);
  assert.ok(reloadedRecords.every(record => record.id.includes(`-${record.due}-`)));
});

test('MVP sub-toggles control creation and per-person system bundle edits', () => {
  const state = reducer(createSeed(), {type:'RESET'});
  assert.equal(mvpClinicianCreationEnabled(state.settings),false);
  assert.equal(mvpBundleEditingEnabled(state.settings),false);
  const person = state.people.find(item=>item.id==='YS-1024');
  const episode = person.episodes.find(item=>item.id==='EP-1024-01');
  const bundle = episode.collections.filter(item=>item.mvpTimepointId && item.mvpRespondent==='Person');
  const action = {type:'CUSTOMIZE_MVP_BUNDLE',operation:'add',personId:person.id,episodeId:episode.id,
    bundleId:bundle[0].bundleId,version:'Initial assessment v1.0'};
  assert.equal(reducer(state,action),state);
  const editingEnabled = reducer(state,{type:'SET_MVP_BUNDLE_EDITING',enabled:true});
  const added = reducer(editingEnabled,action);
  const updatedEpisode = added.people.find(item=>item.id===person.id).episodes.find(item=>item.id===episode.id);
  const addedRecord = updatedEpisode.collections.find(item=>item.bundleId===action.bundleId && item.version===action.version);
  assert.ok(addedRecord);
  assert.equal(addedRecord.bundleRequirement,'Mandatory');
  const removed = reducer(added,{...action,operation:'remove',collectionId:addedRecord.id});
  assert.equal(removed.people.find(item=>item.id===person.id).episodes.find(item=>item.id===episode.id)
    .collections.some(item=>item.id===addedRecord.id),false);
  const disabled = reducer(state,{type:'SET_MVP_BUNDLE_EDITING',enabled:false});
  assert.equal(reducer(disabled,action),disabled);
});

test('scheduled review reminder is one per incomplete bundle and stops after completion', () => {
  const state = createSeed();
  const next = reducer(state, { type: 'RESET' });
  const person = next.people.find(item => item.id === 'YS-1024');
  const episode = person.episodes.find(item => item.id === 'EP-1024-01');
  const records = episode.collections.filter(record => record.mvpTimepointId);
  assert.ok(records.length);
  records.forEach(record => { record.due = '2026-09-30'; });
  const before = getNotifications(next, '2026-09-26').filter(item => item.category === 'scheduled_review' && item.personId === person.id);
  assert.equal(before.length, 2);
  records.filter(record => record.mvpRespondent === 'Person').forEach(record => { record.response = 'Submitted'; });
  const after = getNotifications(next, '2026-09-26').filter(item => item.category === 'scheduled_review' && item.personId === person.id);
  assert.equal(after.length, 1);
});

test('fictional MVP timeline shows a completed initial measure and pending review', () => {
  const switched = reducer(createSeed(), { type: 'RESET' });
  const person = switched.people.find(item => item.id === 'YS-1034');
  const episode = person.episodes.find(item => item.id === 'EP-1034-01');
  const clinicianReview = episode.collections.find(record => record.mvpTimepointId &&
    record.mvpRespondent === 'Clinician' && record.response !== 'Submitted');
  const collecting = reducer(switched, { type: 'DELIVER', personId: person.id,
    episodeId: episode.id, collectionId: clinicianReview.id, channel: clinicianReview.channel,
    respondent: 'Clinician', assistance: 'Independent' });
  assert.ok(collecting.people.find(item => item.id === person.id).episodes.find(item => item.id === episode.id)
    .collections.find(record => record.id === clinicianReview.id).respondentName);
  const pathwayRecords = episode.collections.filter(record => record.mvpInitialAssessment ||
    record.mvpTimepointId || record.mvpCreatedAssessment);
  const completedNames = assessmentBundleGroups(episode, pathwayRecords)
    .filter(group => group.records.every(record => record.response === 'Submitted'))
    .map(group => group.name);
  assert.deepEqual(completedNames, ['Initial assessment · Young person · General']);
  const initial = pathwayRecords.filter(record => record.mvpInitialAssessment && record.mvpRespondent === 'Person');
  assert.equal(initial.length, 17);
  assert.ok(initial.every(record => record.response === 'Submitted' && record.submittedAt === '2026-06-16'));
  assert.ok(pathwayRecords.filter(record => record.mvpTimepointId && record.mvpRespondent === 'Person')
    .every(record => record.response === 'Not started' && record.bundleSource === 'Scheduled'));
  assert.ok(pathwayRecords.filter(record => record.mvpDemoExample).every(record =>
    questionnaireState(getInstrument(record.version), record.answers).complete));
  assert.equal(pathwayRecords.filter(record => record.mvpCreatedAssessment).length, 0);
  const timelineMeasures = careEventEntries(person, episode, [], {
    simpleAssessments: true, scheduleAssessments: false, phase2Mvp: true, today: '2026-10-01',
  }).filter(entry => entry.type === 'assessment');
  assert.equal(timelineMeasures.length, 1);
  assert.ok(timelineMeasures.every(entry => entry.mvpInitialAssessment || entry.mvpTimepointId));
  assert.ok(timelineMeasures.every(entry => entry.bundleCollectionIds.length === initial.length));
  const reloaded = reconcileMvpAssessmentPathway(upgradeSampleData(structuredClone(switched)), '2026-09-30');
  const reloadedEpisode = reloaded.people.find(item => item.id === person.id).episodes.find(item => item.id === episode.id);
  assert.equal(reloadedEpisode.collections.filter(record => record.mvpCreatedAssessment).length, 0);
  assert.ok(reloadedEpisode.collections.filter(record => record.mvpInitialAssessment)
    .every(record => record.due === episode.start));
});

test('fixture refresh leaves a saved initial assessment draft untouched', () => {
  const saved = reconcileMvpAssessmentPathway(createDefaultWorkspace(), '2026-10-02');
  const episode = saved.people.find(person => person.id === 'YS-1034').episodes[0];
  const initial = episode.collections.filter(record => record.mvpInitialAssessment && record.mvpRespondent === 'Person');
  for (const record of initial) {
    record.response = 'Not started';
    record.assignment = 'Planned';
    record.answers = [];
    record.attempts = [];
  }
  initial[0].response = 'Draft';
  initial[0].draftAnswers = ['Saved staff draft'];
  episode.mvpDemoExamplesRevision = 8;
  const refreshed = reconcileMvpAssessmentPathway(saved, '2026-10-02');
  const records = refreshed.people.find(person => person.id === 'YS-1034').episodes[0].collections
    .filter(record => record.mvpInitialAssessment && record.mvpRespondent === 'Person');
  assert.equal(records[0].response, 'Draft');
  assert.deepEqual(records[0].draftAnswers, ['Saved staff draft']);
  assert.ok(records.slice(1).every(record => record.response === 'Not started'));
});

test('older fictional review submissions are returned to pending without changing the saved state', () => {
  const switched = reducer(createSeed(), { type: 'SET_ADVANCED_ASSESSMENT_OPTIONS', enabled: false });
  const episode = switched.people.find(item => item.id === 'YS-1034').episodes.find(item => item.id === 'EP-1034-01');
  const review = episode.collections.filter(record => record.mvpTimepointId && record.mvpRespondent === 'Person');
  for (const record of review) Object.assign(record, {
    response: 'Submitted', assignment: 'Fulfilled', mvpDemoExample: true,
    submittedAttemptId: `${record.id}-mvp-example-session`, answers: ['sample'],
    attempts: [{ id: `${record.id}-mvp-example-session`, status: 'Response submitted' }],
  });
  episode.mvpDemoExamplesRevision = 4;
  const restored = reconcileMvpAssessmentPathway(switched, '2026-09-30');
  const restoredReview = restored.people.find(item => item.id === 'YS-1034').episodes.find(item => item.id === 'EP-1034-01')
    .collections.filter(record => record.mvpTimepointId && record.mvpRespondent === 'Person');
  assert.ok(restoredReview.every(record => record.response === 'Not started' && !record.mvpDemoExample));
  assert.ok(review.every(record => record.response === 'Submitted'));
});

test('fictional review example leaves a saved young-person draft intact', () => {
  const saved = reconcileMvpAssessmentPathway(createDefaultWorkspace(), '2026-10-01');
  const episode = saved.people.find(item => item.id === 'YS-1034').episodes.find(item => item.id === 'EP-1034-01');
  const youngReview = episode.collections.filter(record => record.mvpTimepointId && record.mvpRespondent === 'Person');
  for (const record of youngReview) {
    record.response = 'Draft';
    record.assignment = 'Active';
    record.draftAnswers = ['Saved staff draft'];
    record.attempts = [{ id: `${record.id}-staff-draft`, status: 'Progress saved' }];
    delete record.mvpDemoExample;
  }
  episode.mvpDemoExamplesRevision = 7;
  const upgraded = reconcileMvpAssessmentPathway(saved, '2026-10-01');
  const updated = upgraded.people.find(item => item.id === 'YS-1034').episodes.find(item => item.id === 'EP-1034-01');
  assert.ok(updated.collections.filter(record => record.mvpTimepointId && record.mvpRespondent === 'Person')
    .every(record => record.response === 'Draft' && record.draftAnswers[0] === 'Saved staff draft'));
  assert.ok(updated.collections.filter(record => record.mvpTimepointId && record.mvpRespondent === 'Family respondent')
    .every(record => record.response === 'Submitted' && record.respondentName === 'Alex Ellis'));
});
