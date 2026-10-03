import test from 'node:test';
import assert from 'node:assert/strict';
import { asBundle, bundleError, bundleTiming, reconcileAssessmentBundles } from './assessmentBundles.js';
import { canCollectInEpisode, createSeed, reducer, upgradeSampleData } from './model.js';
import { getInstrument } from './instruments.js';

const assessment = (extra = {}) => ({id:'item',version:'EP Batch 2 · Living Situation v1.0',
  channel:'Clinic tablet',recipient:'Person',requirement:'Mandatory',...extra});
const rule = (extra = {}) => ({id:'timing-bundle',name:'Timing review',trigger:'current',
  programStream:'Mood',careLevel:'Mid',days:7,timing:'days',repeat:true,enabled:true,
  assessments:[assessment()],...extra});
const make = bundle => ({settings:{automaticAssessmentDueDates:true,assessmentScheduleRules:[bundle]},
  people:[{id:'person',dob:'2008-09-15',intakes:[],episodes:[{id:'episode',status:'Active',start:'2026-09-01',
    carePeriods:[{startDate:'2026-09-01',endDateExclusive:null,programStream:'Mood',careLevel:'Mid'}],collections:[]}]}]});
const episode = state => state.people[0].episodes[0];
const today = '2026-09-28';

test('timing validation and legacy defaults preserve recurring day bundles', () => {
  for (const timing of ['intake','discharge']) {
    assert.equal(bundleError(rule({timing,repeat:false,days:0})),null);
    assert.ok(bundleError(rule({timing,repeat:true})));
  }
  assert.ok(bundleError(rule({timing:'unknown'})));
  assert.ok(bundleError(rule({repeat:'yes'})));
  assert.ok(bundleError(rule({days:0})));
  const legacy = rule();delete legacy.timing;delete legacy.repeat;
  assert.equal(asBundle(legacy).timing,'days');assert.equal(asBundle(legacy).repeat,true);
  assert.equal(bundleTiming(legacy),'Every 7 days');
  assert.equal(bundleTiming(rule({repeat:false})),'Once, 7 days after care period starts');
  assert.equal(bundleTiming(rule({timing:'intake',repeat:false})),'At intake');
  assert.equal(bundleTiming(rule({timing:'discharge',repeat:false})),'At discharge');
});

test('one-time day bundles retain completed work and skipped optional choices without another cycle', () => {
  const initial = make(rule({repeat:false,assessments:[assessment(),assessment({id:'optional',requirement:'Optional',channel:'Clinician entry'})]}));
  const next = reconcileAssessmentBundles(initial,today);
  assert.equal(episode(next).collections[0].due,'2026-09-08');
  episode(next).collections[0].response='Submitted';
  episode(next).collections[0].answers=['saved'];
  episode(next).assessmentBundleOffers[0].status='Skipped';
  assert.equal(reconcileAssessmentBundles(next,'2026-12-01'),next);
  assert.deepEqual(episode(next).collections[0].answers,['saved']);
});

test('intake bundles use completed intake for the episode and match conditions on its date', () => {
  const initial = make(rule({timing:'intake',repeat:false,minAge:17,maxAge:17}));
  const intake = {id:'intake',episodeId:'episode',status:'In progress',outcome:'Proceed',decisionAt:'2026-09-10T12:00:00Z'};
  initial.people[0].intakes=[intake];
  assert.equal(reconcileAssessmentBundles(initial,today),initial);
  intake.status='Completed';intake.outcome='Do not proceed';
  assert.equal(reconcileAssessmentBundles(initial,today),initial);
  intake.outcome='Proceed';intake.episodeId='another';
  assert.equal(reconcileAssessmentBundles(initial,today),initial);
  intake.episodeId='episode';
  const next = reconcileAssessmentBundles(initial,today);
  assert.equal(episode(next).collections[0].due,'2026-09-10');
  assert.equal(episode(next).collections[0].bundleTimingSourceId,'intake');
  assert.equal(episode(next).collections[0].bundleContext.repeat,false);
  assert.equal(reconcileAssessmentBundles(next,'2026-12-01'),next);
  initial.settings.assessmentScheduleRules[0].careLevel='High';
  assert.equal(reconcileAssessmentBundles(initial,today),initial);
});

test('discharge bundles run once on the closure date and retain collection eligibility', () => {
  const initial = make(rule({timing:'discharge',repeat:false,
    assessments:[assessment(),assessment({id:'optional',requirement:'Optional',channel:'Clinician entry'})]}));
  assert.equal(reconcileAssessmentBundles(initial,today),initial);
  episode(initial).status='Closed';episode(initial).end='2026-09-20';
  episode(initial).carePeriods[0].endDateExclusive='2026-09-21';
  const next = reconcileAssessmentBundles(initial,today);
  const collection = episode(next).collections[0];
  assert.equal(collection.due,'2026-09-20');assert.equal(collection.dischargeFollowUp,true);
  assert.equal(canCollectInEpisode(episode(next),collection),true);
  assert.equal(canCollectInEpisode(episode(next),{version:collection.version}),false);
  assert.equal(episode(next).assessmentBundleOffers[0].dischargeFollowUp,true);
  assert.equal(reconcileAssessmentBundles(next,today),next);
  for (const status of ['Completed','Paused']) {
    episode(initial).status=status;assert.equal(reconcileAssessmentBundles(initial,today),initial);
  }
});

test('saving and reloading retains timing, and optional discharge assessments can be included after closure', () => {
  let state=createSeed();
  const personId='YS-DEMO-CLOSE';
  const getEpisode = () => state.people.find(person=>person.id===personId).episodes[0];
  state=reducer(state,{type:'SAVE_ASSESSMENT_SCHEDULE_RULE',rule:rule({timing:'discharge',repeat:false,
    programStream:'All',careLevel:'All',assessments:[assessment({requirement:'Optional'})]})});
  state=reducer(state,{type:'SET_AUTOMATIC_ASSESSMENT_DUE_DATES',enabled:true});
  const offer=getEpisode().assessmentBundleOffers.find(offer=>offer.bundleId==='timing-bundle');
  assert.ok(offer);
  state=reducer(state,{type:'SELECT_BUNDLE_ASSESSMENTS',personId,episodeId:getEpisode().id,offerIds:[offer.id],decision:'Include'});
  const collection=getEpisode().collections.find(collection=>collection.id===offer.id);
  assert.equal(collection.dischargeFollowUp,true);assert.equal(canCollectInEpisode(getEpisode(),collection),true);
  state=upgradeSampleData(JSON.parse(JSON.stringify(state)));
  const saved=state.settings.assessmentScheduleRules.find(rule=>rule.id==='timing-bundle');
  assert.equal(saved.timing,'discharge');assert.equal(saved.repeat,false);
  assert.equal(getEpisode().collections.find(collection=>collection.id===offer.id).dischargeFollowUp,true);
});

test('discharge assessments can be answered and keep closure pending until their review is complete', () => {
  let state=createSeed();const personId='YS-DEMO-CLOSE';
  const getEpisode = () => state.people.find(person=>person.id===personId).episodes[0];
  state=reducer(state,{type:'SAVE_ASSESSMENT_SCHEDULE_RULE',rule:rule({timing:'discharge',repeat:false,programStream:'All',careLevel:'All'})});
  state=reducer(state,{type:'SET_AUTOMATIC_ASSESSMENT_DUE_DATES',enabled:true});
  const submit = collection => {state=reducer(state,{type:'SUBMIT',personId,episodeId:getEpisode().id,
    collectionId:collection.id,attemptId:collection.attempts.at(-1).id,channel:collection.channel,
    answers:getInstrument(collection.version).questions.map(question=>question.options[0])});};
  for (const kind of ['assessment','feedback']) submit(getEpisode().collections.find(collection=>collection.closureKind===kind));
  state=reducer(state,{type:'REVIEW',personId,episodeId:getEpisode().id,
    collectionId:getEpisode().collections.find(collection=>collection.closureKind==='assessment').id,note:'Closure reviewed.'});
  assert.equal(getEpisode().status,'Closed');
  const followUp=getEpisode().collections.find(collection=>collection.dischargeFollowUp);
  state=reducer(state,{type:'DELIVER',personId,episodeId:getEpisode().id,collectionId:followUp.id,
    channel:'Clinic tablet',respondent:'Person',assistance:'Independent',appointmentId:null});
  assert.equal(getEpisode().collections.find(collection=>collection.id===followUp.id).assignment,'Active');
  submit(getEpisode().collections.find(collection=>collection.id===followUp.id));
  assert.equal(getEpisode().status,'Closed');
  state=reducer(state,{type:'REVIEW',personId,episodeId:getEpisode().id,collectionId:followUp.id,note:'Discharge reviewed.'});
  assert.equal(getEpisode().status,'Completed');
});
