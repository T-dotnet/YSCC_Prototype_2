import test from 'node:test';
import assert from 'node:assert/strict';
import { asBundle, bundleError, bundleScheduleHint, bundleTiming, reconcileAssessmentBundles } from './assessmentBundles.js';
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

test('schedule help text describes every trigger and one-time or repeating behavior', () => {
  const examples = [
    [{after:'new-profile',days:28,repeat:true}, 'First due 28 days after the new profile is created, then every 28 days.'],
    [{after:'new-profile',days:1,repeat:false}, 'Due once 1 day after the new profile is created.'],
    [{after:'intake',days:7,repeat:false}, 'Due once 7 days after intake is completed and care proceeds.'],
    [{after:'referral',referralStatus:'Denied',days:2,repeat:true}, 'Due once for each referral marked Denied, 2 days later.'],
    [{after:'discharge',days:14,repeat:true}, 'First due 14 days after this care episode closes, then every 14 days.'],
    [{after:'specific-measure',triggerMeasureIds:['pack-a','pack-b'],triggerMeasureStatuses:['completed','overdue'],days:3,repeat:false},
      'Due once 3 days after any selected Assessment Pack reaches any selected status.'],
    [{after:'program-change',days:5,repeat:false}, 'Due once 5 days after the program changes.'],
    [{after:'care-level-change',days:5,repeat:false}, 'Due once 5 days after the care level changes.'],
    [{after:'care-period',days:7,repeat:true}, 'First due 7 days after the care period starts, then every 7 days.'],
    [{after:'other',days:4,repeat:false}, 'Due once 4 days after the selected event occurs.'],
    [{trigger:'event',eventType:'level-change',delayDays:0}, 'Due once on each matching event date.'],
    [{trigger:'event',eventType:'level-change',delayDays:1}, 'Due once for each matching event, 1 day later.'],
    [{timing:'date',dueDate:'2026-10-20'}, 'Due once on the selected date.'],
    [{timing:'intake'}, 'Due once when intake is completed and care proceeds.'],
    [{timing:'discharge'}, 'Due once when this care episode closes.'],
    [{after:'specific-measure',triggerMeasureIds:[],triggerMeasureStatuses:[]}, 'Choose Assessment Packs and statuses to preview this schedule.'],
    [{days:0}, 'Enter a valid time in days to preview this schedule.'],
  ];
  for (const [settings, expected] of examples)
    assert.equal(bundleScheduleHint(rule(settings)),expected,JSON.stringify(settings));
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

test('program and care level changes trigger only their matching Assessment Packs', () => {
  const rules = [
    rule({id:'program-change',name:'Program follow-up',after:'program-change',repeat:false}),
    rule({id:'care-level-change',name:'Care level follow-up',after:'care-level-change',repeat:false}),
  ];
  const stateFor = (oldStream, oldLevel) => ({
    settings:{automaticAssessmentDueDates:true,assessmentScheduleRules:rules},
    people:[{id:'person',episodes:[
      {id:'new',status:'Active',start:'2026-09-20',programStream:'Mood',previousEpisodeId:'old',
        carePeriods:[{startDate:'2026-09-20',endDateExclusive:null,programStream:'Mood',careLevel:'Mid'}],
        events:[{id:'change',actionType:'CHANGE_CARE_LEVEL',previousEpisodeId:'old',
          title:'Care episode started after level change',effectiveDate:'2026-09-20'}],collections:[]},
      {id:'old',status:'Closed',start:'2026-09-01',programStream:oldStream,
        carePeriods:[{startDate:'2026-09-01',endDateExclusive:'2026-09-20',programStream:oldStream,careLevel:oldLevel}],
        collections:[]},
    ]}],
  });
  const created = state => state.people[0].episodes[0].collections.map(item => item.scheduleRuleId).sort();
  assert.deepEqual(created(reconcileAssessmentBundles(stateFor('Psychosis','Mid'),today)),['program-change']);
  assert.deepEqual(created(reconcileAssessmentBundles(stateFor('Mood','High'),today)),['care-level-change']);
  assert.deepEqual(created(reconcileAssessmentBundles(stateFor('Psychosis','High'),today)),['care-level-change','program-change']);
  assert.deepEqual(created(reconcileAssessmentBundles(stateFor('Mood','Mid'),today)),[]);
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
