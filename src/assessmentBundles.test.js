import test from 'node:test';
import assert from 'node:assert/strict';
import { bundleError, asBundle, reconcileAssessmentBundles, bundleAgeMatches } from './assessmentBundles.js';
import { assessmentsWithDueVisibility } from './assessmentDue.js';
import { createSeed, reducer, TODAY, upgradeSampleData } from './model.js';
const version='Your preferences and next steps v2.0';
const item=(extra={})=>({id:'one',version,channel:'Clinician entry',recipient:'Person',requirement:'Mandatory',...extra});
const bundle=(extra={})=>({id:'B',name:'Care review',trigger:'current',programStream:'General',careLevel:'Mid',weeks:4,enabled:true,assessments:[item()],...extra});
const episode=()=>({id:'E',status:'Active',carePeriods:[{startDate:'2026-09-01',endDateExclusive:null,programStream:'General',careLevel:'Mid'}],events:[],collections:[]});
const make=(b=bundle())=>({settings:{automaticAssessmentDueDates:true,assessmentSms:false,assessmentScheduleRules:[b]},people:[{id:'P',family:'Family',episodes:[episode()]}]});
const ep=s=>s.people[0].episodes[0];
const today='2026-09-28';
test('bundle validates names, multiple targets, recipient support and event timing',()=>{
 assert.equal(bundleError(bundle()),null);
 assert.ok(bundleError(bundle({name:''})));
 assert.ok(bundleError(bundle({assessments:[item(),item({id:'two'})]})));
 assert.equal(bundleError(bundle({assessments:[item(),item({id:'two',version:'Initial assessment v1.0',channel:'Clinic tablet',recipient:'Family respondent'})]})),null);
 assert.ok(bundleError(bundle({trigger:'event',eventType:'harm',delayDays:-1})));
});
test('mandatory assessments share bundle delivery settings; optional waits for staff',()=>{
 const original=make(bundle({assessments:[item(),item({id:'two',version:'Initial assessment v1.0',channel:'Clinic tablet',recipient:'Family respondent'}),item({id:'opt',channel:'Clinic tablet',requirement:'Optional'})]}));
 const next=reconcileAssessmentBundles(original,today);
 assert.equal(ep(next).collections.length,2);
 assert.deepEqual(ep(next).collections.map(c=>[c.channel,c.respondent,c.bundleRequirement]),[['Clinician entry','Person','Mandatory'],['Clinician entry','Person','Mandatory']]);
 assert.equal(ep(next).assessmentBundleOffers.length,1);
 assert.equal(ep(original).collections.length,0);
 assert.equal(reconcileAssessmentBundles(next,today),next);
 assert.equal(assessmentsWithDueVisibility(ep(next).collections,today).length,2);
});
test('current bundles match effective program/level and keep future drafts and completed answers',()=>{
 const state=make();ep(state).carePeriods.push({startDate:'2026-10-01',endDateExclusive:null,programStream:'Psychosis',careLevel:'High'});ep(state).carePeriods[0].endDateExclusive='2026-10-01';
 state.settings.assessmentScheduleRules=[bundle({programStream:'Psychosis',careLevel:'High'})];
 assert.equal(reconcileAssessmentBundles(state,today),state);
 const generated=reconcileAssessmentBundles(state,'2026-10-01');
 assert.equal(ep(generated).collections[0].due,'2026-10-29');
 ep(generated).collections[0].response='Draft';ep(generated).collections[0].assignment='Active';ep(generated).collections[0].draftAnswers=['saved'];
 assert.equal(reconcileAssessmentBundles(generated,'2026-10-20'),generated);
 const due=reconcileAssessmentBundles(generated,'2026-10-29');
 assert.equal(ep(due).collections.length,2);assert.deepEqual(ep(due).collections[0].draftAnswers,['saved']);assert.equal(ep(due).collections[1].due,'2026-11-26');
});
test('event bundles run once per recorded event; historical events and future events are excluded',()=>{
 const state=make(bundle({trigger:'event',eventType:'harm',delayDays:3,activationEventIds:['past']}));
 ep(state).events=[{id:'past',actionType:'ADD_CARE_EVENT',eventType:'harm',date:'2026-09-01'},{id:'new',actionType:'ADD_CARE_EVENT',eventType:'harm',eventDate:'2026-09-27'},{id:'future',actionType:'ADD_CARE_EVENT',eventType:'harm',date:'2026-10-01'}];
 const next=reconcileAssessmentBundles(state,today);
 assert.equal(ep(next).collections.length,1);assert.equal(ep(next).collections[0].due,'2026-09-30');assert.equal(ep(next).collections[0].bundleEventId,'new');
 assert.equal(reconcileAssessmentBundles(next,today),next);
 next.settings.assessmentScheduleRules[0].delayDays=5;
 assert.equal(reconcileAssessmentBundles(next,today),next);
});
test('SMS and disabled automation pause creation without losing configured rows',()=>{
 const state=make(bundle({assessments:[item({channel:'SMS link'})]}));
 assert.equal(reconcileAssessmentBundles(state,today),state);
 state.settings.assessmentSms=true;assert.equal(ep(reconcileAssessmentBundles(state,today)).collections[0].channel,'SMS link');
 state.settings.automaticAssessmentDueDates=false;assert.equal(reconcileAssessmentBundles(state,today),state);
});
test('staff selection includes only selected optional assessments and survives reload/upgrade',()=>{
 let state=createSeed();const p=state.people.find(p=>p.id==='YS-1034');const e=p.episodes.find(e=>e.id==='EP-1034-01');
 state=reducer(state,{type:'SAVE_ASSESSMENT_SCHEDULE_RULE',rule:bundle({programStream:'All',careLevel:'All',assessments:[item(),item({id:'opt',channel:'Clinic tablet',requirement:'Optional'})]})});
 state=reducer(state,{type:'SET_AUTOMATIC_ASSESSMENT_DUE_DATES',enabled:true});
 const current=()=>state.people.find(x=>x.id===p.id).episodes.find(x=>x.id===e.id);
 const offer=current().assessmentBundleOffers[0];assert.ok(offer);assert.ok(!current().collections.some(c=>c.id===offer.id));
 state=reducer(state,{type:'SELECT_BUNDLE_ASSESSMENTS',personId:p.id,episodeId:e.id,offerIds:[offer.id],decision:'Include'});
 assert.equal(current().collections.find(c=>c.id===offer.id).bundleRequirement,'Optional');
 const before=state;state=reducer(state,{type:'SELECT_BUNDLE_ASSESSMENTS',personId:p.id,episodeId:e.id,offerIds:[offer.id],decision:'Include'});assert.equal(state,before);
 const upgraded=upgradeSampleData(JSON.parse(JSON.stringify(state)));assert.equal(upgraded.people.find(x=>x.id===p.id).episodes.find(x=>x.id===e.id).collections.find(c=>c.id===offer.id).respondent,'Person');
});
test('saving an event bundle snapshots previous events; new care events trigger assessments',()=>{
 let state=createSeed();state=reducer(state,{type:'SAVE_ASSESSMENT_SCHEDULE_RULE',rule:bundle({trigger:'event',eventType:'other',delayDays:2})});
 assert.ok(state.settings.assessmentScheduleRules[0].activationEventIds.length);
 state=reducer(state,{type:'SET_AUTOMATIC_ASSESSMENT_DUE_DATES',enabled:true});
 state=reducer(state,{type:'ADD_CARE_EVENT',personId:'YS-1034',episodeId:'EP-1034-01',eventType:'other',eventDate:TODAY,summary:'Bundle test event'});
 const e=state.people.find(p=>p.id==='YS-1034').episodes.find(e=>e.id==='EP-1034-01');
 assert.ok(e.collections.some(c=>c.bundleEventId));
});
test('converting a legacy rule retains its pending auto assessment without duplicating it',()=>{
 const legacy={id:'B',version,programStream:'General',careLevel:'Mid',weeks:4,enabled:true};
 const state=make(asBundle(legacy));
 ep(state).collections=[{id:'legacy',version,due:'2026-09-29',scheduleRuleId:'B',scheduleAnchor:'2026-09-01',assignment:'Planned',response:'Not started'}];
 assert.equal(reconcileAssessmentBundles(state,today),state);
});
test('skipping a future optional assessment waits until that cycle is due',()=>{
 const state=make(bundle({assessments:[item({requirement:'Optional'})]}));
 const next=reconcileAssessmentBundles(state,today);const offer=ep(next).assessmentBundleOffers[0];
 offer.status='Skipped';
 assert.equal(reconcileAssessmentBundles(next,today),next);
 const due=reconcileAssessmentBundles(next,'2026-09-29');
 assert.equal(ep(due).assessmentBundleOffers.length,2);
 assert.equal(ep(due).assessmentBundleOffers[1].due,'2026-10-27');
});
test('family-only optional assessments cannot be included without a family recipient',()=>{
 let state=createSeed();const person=state.people.find(p=>p.id==='YS-1034');person.family='';
 state=reducer(state,{type:'SAVE_ASSESSMENT_SCHEDULE_RULE',rule:bundle({programStream:'All',careLevel:'All',assessments:[item({recipient:'Family respondent',requirement:'Optional'})]})});
 state=reducer(state,{type:'SET_AUTOMATIC_ASSESSMENT_DUE_DATES',enabled:true});
 const offer=state.people.find(p=>p.id==='YS-1034').episodes.find(e=>e.id==='EP-1034-01').assessmentBundleOffers[0];
 assert.equal(reducer(state,{type:'SELECT_BUNDLE_ASSESSMENTS',personId:'YS-1034',episodeId:'EP-1034-01',offerIds:[offer.id],decision:'Include'}),state);
});
test('editing an optional row to mandatory creates it without losing existing assessments',()=>{
 let state=createSeed();const rule=bundle({programStream:'All',careLevel:'All',assessments:[item({requirement:'Optional'})]});
 state=reducer(state,{type:'SAVE_ASSESSMENT_SCHEDULE_RULE',rule});
 state=reducer(state,{type:'SET_AUTOMATIC_ASSESSMENT_DUE_DATES',enabled:true});
 const before=state.people.find(p=>p.id==='YS-1034').episodes.find(e=>e.id==='EP-1034-01');
 assert.ok(before.assessmentBundleOffers.length);
 state=reducer(state,{type:'SAVE_ASSESSMENT_SCHEDULE_RULE',rule:{...rule,assessments:[item()]}});
 const after=state.people.find(p=>p.id==='YS-1034').episodes.find(e=>e.id==='EP-1034-01');
 assert.equal(after.assessmentBundleOffers.length,0);
 assert.equal(after.collections.length,before.collections.length+1);
 for(const original of before.collections)assert.deepEqual(after.collections.find(c=>c.id===original.id),original);
});

test('age limits are inclusive, use birthdays, and reject missing or invalid birth dates',()=>{
 const range=bundle({minAge:12,maxAge:17});
 assert.equal(bundleAgeMatches(range,{dob:'2014-09-28'},today),true);
 assert.equal(bundleAgeMatches(range,{dob:'2014-09-29'},today),false);
 assert.equal(bundleAgeMatches(range,{dob:'2008-09-29'},today),true);
 assert.equal(bundleAgeMatches(range,{dob:'2008-09-28'},today),false);
 for(const dob of [null,'Unknown','2026-02-31','2027-01-01'])assert.equal(bundleAgeMatches(range,{dob},today),false);
 assert.equal(bundleAgeMatches(bundle(),{dob:null},today),true);
 assert.ok(bundleError(bundle({minAge:18,maxAge:12})));
 assert.ok(bundleError(bundle({minAge:1.5})));
 assert.ok(bundleError(bundle({maxAge:121})));
});
test('age matching gates automatic generation without removing existing assessments',()=>{
 const state=make(bundle({minAge:12,maxAge:17}));state.people[0].dob='2008-09-29';
 const next=reconcileAssessmentBundles(state,today);assert.equal(ep(next).collections.length,1);
 assert.equal(reconcileAssessmentBundles(next,'2026-09-29'),next);
 const excluded=make(bundle({minAge:18}));excluded.people[0].dob='2009-02-12';assert.equal(reconcileAssessmentBundles(excluded,today),excluded);
});
test('bundle enable switch preserves age settings and existing assignments across reload',()=>{
 let state=createSeed();const saved=bundle({minAge:12,maxAge:17,programStream:'All',careLevel:'All'});
 state=reducer(state,{type:'SAVE_ASSESSMENT_SCHEDULE_RULE',rule:saved});
 state=reducer(state,{type:'SET_AUTOMATIC_ASSESSMENT_DUE_DATES',enabled:true});
 const ids=state.people.flatMap(p=>p.episodes.flatMap(e=>e.collections)).filter(c=>c.bundleId==='B').map(c=>c.id);
 assert.ok(ids.length);
 state=reducer(state,{type:'SAVE_ASSESSMENT_SCHEDULE_RULE',rule:{...state.settings.assessmentScheduleRules[0],enabled:false}});
 assert.equal(state.settings.assessmentScheduleRules[0].enabled,false);
 const upgraded=upgradeSampleData(JSON.parse(JSON.stringify(state)));assert.equal(upgraded.settings.assessmentScheduleRules[0].minAge,12);assert.equal(upgraded.settings.assessmentScheduleRules[0].maxAge,17);
 assert.deepEqual(upgraded.people.flatMap(p=>p.episodes.flatMap(e=>e.collections)).filter(c=>c.bundleId==='B').map(c=>c.id),ids);
 state=reducer(upgraded,{type:'SAVE_ASSESSMENT_SCHEDULE_RULE',rule:{...upgraded.settings.assessmentScheduleRules[0],enabled:true}});
 assert.equal(state.settings.assessmentScheduleRules[0].enabled,true);
 assert.deepEqual(state.people.flatMap(p=>p.episodes.flatMap(e=>e.collections)).filter(c=>c.bundleId==='B').map(c=>c.id),ids);
});
test('day-based cadence supports intervals shorter than a week and advances by exact days',()=>{
 const state=make(bundle({days:5}));
 const next=reconcileAssessmentBundles(state,today);
 assert.equal(ep(next).collections[0].due,'2026-09-06');
 ep(next).collections[0].response='Submitted';ep(next).collections[0].submittedAt='2026-09-06T12:00:00Z';
 const following=reconcileAssessmentBundles(next,today);
 assert.equal(ep(following).collections[1].due,'2026-09-11');
 assert.ok(bundleError(bundle({days:0})));
 assert.ok(bundleError(bundle({days:729})));
});
test('saving an old four-week bundle converts to 28 days and retains existing due dates',()=>{
 let state=createSeed();const old=bundle({programStream:'All',careLevel:'All'});
 state=reducer(state,{type:'SAVE_ASSESSMENT_SCHEDULE_RULE',rule:old});
 assert.equal(state.settings.assessmentScheduleRules[0].days,28);
 assert.equal(state.settings.assessmentScheduleRules[0].weeks,undefined);
 state=reducer(state,{type:'SET_AUTOMATIC_ASSESSMENT_DUE_DATES',enabled:true});
 const before=state.people.flatMap(p=>p.episodes.flatMap(e=>e.collections)).filter(c=>c.bundleId==='B').map(c=>[c.id,c.due]);
 state=reducer(state,{type:'SAVE_ASSESSMENT_SCHEDULE_RULE',rule:asBundle(old)});
 assert.deepEqual(state.people.flatMap(p=>p.episodes.flatMap(e=>e.collections)).filter(c=>c.bundleId==='B').map(c=>[c.id,c.due]),before);
});

 test('shared settings are saved once on the bundle and inherited by all rows and extra assessments',()=>{
  let state=createSeed();
  const rule=bundle({channel:'Clinician entry',recipient:'Person',programStream:'All',careLevel:'All',
    assessments:[{id:'one',version,requirement:'Mandatory'},
      {id:'two',version:'Initial assessment v1.0',requirement:'Optional'}]});
  state=reducer(state,{type:'SAVE_ASSESSMENT_SCHEDULE_RULE',rule});
  const saved=state.settings.assessmentScheduleRules.find(item=>item.id===rule.id);
  assert.equal(saved.channel,'Clinician entry');assert.equal(saved.recipient,'Person');
  assert.ok(saved.assessments.every(item=>!('channel' in item)&&!('recipient' in item)));
  state=reducer(state,{type:'SET_ASSESSMENT_FEATURE',feature:'groupAssessmentsByBundle',enabled:true});
  state=reducer(state,{type:'CREATE_ASSESSMENT_BUNDLE',personId:'YS-1034',episodeId:'EP-1034-01',
    id:'global-test',bundleId:rule.id,optionalIds:['two'],extraAssessments:[{id:'extra',version:'Life and care check-in v1.0',
      channel:'Clinic tablet',recipient:'Family respondent',requirement:'Optional'}],due:''});
  const records=state.people.find(p=>p.id==='YS-1034').episodes.find(e=>e.id==='EP-1034-01').collections.filter(c=>c.bundleInstanceId==='global-test');
  assert.equal(records.length,3);
  assert.ok(records.every(c=>c.channel==='Clinician entry'&&c.respondent==='Person'));
  const reloaded=upgradeSampleData(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(reloaded.settings.assessmentScheduleRules.find(item=>item.id===rule.id),saved);
  assert.match(bundleError({...rule,recipient:'Family respondent',assessments:[{id:'one',version:'Life and care check-in v1.0',requirement:'Mandatory'}]}),/does not support/);
 });
