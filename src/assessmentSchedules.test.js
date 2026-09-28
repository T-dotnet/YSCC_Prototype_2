import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileAssessmentSchedules, matchingScheduleRules, scheduleRuleError} from './assessmentSchedules.js';
import {reducer, createSeed, upgradeSampleData} from './model.js';
const rule = (extra={}) => ({id:'rule',version:'Life and care check-in v1.0',programStream:'All',careLevel:'All',weeks:4,enabled:true,...extra});
const episode = {id:'EP',status:'Active',start:'2026-09-01',carePeriods:[{startDate:'2026-09-01',endDateExclusive:null,programStream:'General',careLevel:'Mid'}],collections:[]};
const make = (extra={}) => ({settings:{automaticAssessmentDueDates:true,assessmentScheduleRules:[rule()]},people:[{id:'P',episodes:[structuredClone(episode)]}],...extra});
const collections = state => state.people[0].episodes[0].collections;
const today = '2026-09-28';
test('care-change anchor generates one next collection and reconciles without duplicates',()=>{
 const original=make(); const next=reconcileAssessmentSchedules(original,today);
 assert.equal(collections(next)[0].due,'2026-09-29');
 assert.equal(collections(next)[0].scheduleFree,true);
 assert.equal(collections(original).length,0);
 assert.equal(reconcileAssessmentSchedules(next,today),next);
});
test('specific rules override defaults; stream beats level for partial matches',()=>{
 const rules=[rule(),rule({id:'level',careLevel:'Mid',weeks:2}),rule({id:'stream',programStream:'General',weeks:3}),rule({id:'exact',programStream:'General',careLevel:'Mid',weeks:1})];
 assert.equal(matchingScheduleRules(rules,episode,today)[0].id,'exact');
 assert.equal(matchingScheduleRules(rules.slice(0,3),episode,today)[0].id,'stream');
});
test('future drafts block; draft due today exposes one following cycle without losing answers',()=>{
 const state=make();const draft={id:'D',version:rule().version,response:'Draft',assignment:'Active',due:'2026-09-29',answers:['saved']};collections(state).push(draft);
 assert.equal(reconcileAssessmentSchedules(state,today),state);
 const next=reconcileAssessmentSchedules(state,'2026-09-29');
 assert.equal(collections(next).length,2);assert.equal(collections(next)[1].due,'2026-10-27');assert.deepEqual(collections(next)[0],draft);
});
test('early completion advances to the next cadence cycle',()=>{
 const state=make();collections(state).push({id:'D',version:rule().version,response:'Submitted',assignment:'Fulfilled',due:'2026-09-29',submittedAt:'2026-09-20T12:00:00Z'});
 assert.equal(collections(reconcileAssessmentSchedules(state,today))[1].due,'2026-10-27');
});
test('effective care period determines rule and anchor, including future changes',()=>{
 const state=make();state.people[0].episodes[0].carePeriods=[{...episode.carePeriods[0],endDateExclusive:'2026-10-01'},{startDate:'2026-10-01',endDateExclusive:null,programStream:'Psychosis',careLevel:'High'}];
 state.settings.assessmentScheduleRules=[rule({programStream:'Psychosis',careLevel:'High',weeks:2})];
 assert.equal(reconcileAssessmentSchedules(state,today),state);
 assert.equal(collections(reconcileAssessmentSchedules(state,'2026-10-01'))[0].due,'2026-10-15');
});
test('disabled automation, closed episodes and archived people create nothing',()=>{
 for(const change of [s=>s.settings.automaticAssessmentDueDates=false,s=>s.people[0].episodes[0].status='Closed',s=>s.people[0].archivedAt=today]){const state=make();change(state);assert.equal(reconcileAssessmentSchedules(state,today),state);}
});
test('reject duplicates and invalid cadence; saving retains booking setting',()=>{
 assert.ok(scheduleRuleError(rule({weeks:0})));assert.ok(scheduleRuleError(rule({id:'other'}),[rule()]));
 let state=createSeed();state=reducer(state,{type:'SAVE_ASSESSMENT_SCHEDULE_RULE',rule:rule()});state=reducer(state,{type:'SET_AUTOMATIC_ASSESSMENT_DUE_DATES',enabled:true});
 assert.equal(state.settings.scheduleAssessments,false);assert.equal(state.settings.showAssessmentDueDates,true);
 const generated=state.people.flatMap(p=>p.episodes.flatMap(e=>e.collections)).filter(c=>c.scheduleRuleId);
 assert.ok(generated.length > 0);
 const upgraded=upgradeSampleData(state);for(const c of generated)assert.equal(upgraded.people.flatMap(p=>p.episodes.flatMap(e=>e.collections)).find(item=>item.id===c.id).due,c.due);
});
