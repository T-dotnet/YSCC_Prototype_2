import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeed, reducer, TODAY, upgradeSampleData } from './model.js';
import { INSTRUMENTS } from './instruments.js';
import { assessmentBundleGroups, uniqueBundleInstanceName, bundleContext, bundleDescription, bundleSelectionForEpisode, reconcileAssessmentBundles, newBundleError } from './assessmentBundles.js';
import { assessmentBundleGroupingEnabled } from './assessmentFeatures.js';

const context = {personId:'YS-1034',episodeId:'EP-1034-01'};
const version = 'EP Batch 2 · Living Situation v1.0';
const otherVersion = 'EP Batch 2 · Assessment Survey v1.0';
const item = (id,requirement='Mandatory',extra={}) => ({id,version,channel:'Clinic tablet',recipient:'Person',requirement,...extra});
const rule = {id:'bundle-ui',name:'Care review',trigger:'current',programStream:'All',careLevel:'All',days:28,enabled:true,
  assessments:[item('mandatory'),item('optional','Optional',{channel:'Clinician entry'})]};
const getEpisode = state => state.people.find(person => person.id === context.personId).episodes.find(episode => episode.id === context.episodeId);
const prepare = () => {
  const seed = createSeed();
  seed.settings.advancedAssessmentOptions = true;
  return reducer(reducer(seed,{type:'SAVE_ASSESSMENT_SCHEDULE_RULE',rule}),
    {type:'SET_ASSESSMENT_FEATURE',feature:'groupAssessmentsByBundle',enabled:true});
};
const action = (extra={}) => ({type:'CREATE_ASSESSMENT_BUNDLE',...context,id:'manual-bundle',bundleId:rule.id,
  optionalIds:[],extraAssessments:[],due:'',...extra});

test('bundle grouping defaults off and persists independently across view modes and saved workspaces', () => {
  assert.equal(assessmentBundleGroupingEnabled({}),false);
  let state = prepare();
  state = reducer(state,{type:'SET_SIMPLE_ASSESSMENTS',enabled:false});
  assert.equal(assessmentBundleGroupingEnabled(state.settings),true);
  assert.equal(upgradeSampleData(JSON.parse(JSON.stringify(state))).settings.groupAssessmentsByBundle,true);
  const before = getEpisode(state).collections;
  state = reducer(state,{type:'SET_ASSESSMENT_FEATURE',feature:'groupAssessmentsByBundle',enabled:false});
  assert.deepEqual(getEpisode(state).collections,before);
});
test('new bundle atomically keeps mandatory, includes selected optional and adds extras without editing template', () => {
  const state = prepare();
  const original = getEpisode(state).collections;
  const next = reducer(state,action({optionalIds:['optional'],extraAssessments:[item('extra','Optional',{version:otherVersion})]}));
  const created = getEpisode(next).collections.slice(original.length);
  assert.equal(created.length,3);
  assert.deepEqual(created.map(collection => collection.bundleRequirement),['Mandatory','Optional','Additional']);
  assert.ok(created.every(collection => collection.bundleSource === 'Manual' && collection.bundleInstanceId === 'manual-bundle' && collection.scheduleFree && !collection.due));
  assert.deepEqual(next.settings.assessmentScheduleRules,state.settings.assessmentScheduleRules);
  assert.deepEqual(getEpisode(next).collections.slice(0,original.length),original);
  assert.equal(reducer(next,action()),next);
  assert.equal(upgradeSampleData(JSON.parse(JSON.stringify(next))).people.find(person => person.id === context.personId).episodes.find(episode => episode.id === context.episodeId).assessmentBundleInstances[0].collectionIds.length,3);
});
test('unchecked optional assessments are excluded and saved with the bundle creation', () => {
  const next = reducer(prepare(),action());
  assert.deepEqual(getEpisode(next).assessmentBundleInstances[0].excludedOptionalIds,['optional']);
  assert.equal(getEpisode(next).collections.filter(collection => collection.bundleInstanceId === 'manual-bundle').length,1);
});
test('invalid or unavailable selection cannot partially create a bundle', () => {
  const state = reducer(prepare(),{type:'SET_ASSESSMENT_FEATURE',feature:'assessmentSms',enabled:false});
  for (const override of [{optionalIds:['mandatory']},{optionalIds:['missing']},{optionalIds:['optional','optional']},
    {extraAssessments:[item('extra','Optional')]},{extraAssessments:[item('extra','Optional',{version:otherVersion,channel:'SMS link'})]},
    {bundleId:'missing'},{due:TODAY}]) assert.equal(reducer(state,action(override)),state);
  const disabled = reducer(state,{type:'SET_ASSESSMENT_FEATURE',feature:'groupAssessmentsByBundle',enabled:false});
  assert.equal(reducer(disabled,action()),disabled);
  const closed = JSON.parse(JSON.stringify(state));getEpisode(closed).status='Closed';
  assert.equal(reducer(closed,action()),closed);
  const historical = JSON.parse(JSON.stringify(state));historical.people.find(person => person.id === context.personId).intakes.forEach(intake => intake.outcome='Do not proceed');
  assert.notEqual(reducer(historical,action()),historical);
});
test('scheduled bundle creation respects scheduling switch and due date without enabling contacts', () => {
  const state = reducer(prepare(),{type:'SET_ASSESSMENT_FEATURE',feature:'scheduleAssessments',enabled:true});
  assert.equal(reducer(state,action()),state);
  assert.equal(reducer(state,action({due:'2026-02-30'})),state);
  const next = reducer(state,action({due:TODAY}));
  const created = getEpisode(next).collections.find(collection => collection.bundleInstanceId === 'manual-bundle');
  assert.equal(created.due,TODAY);assert.equal(created.scheduleFree,false);assert.equal(created.appointmentId,null);
});
test('bundle grouping keeps different assessment types together and individual or deleted-template records visible', () => {
  const records = [{id:'one',version,bundleId:rule.id,bundleName:rule.name,bundleContext:bundleContext(rule),response:'Submitted',submittedAt:`${TODAY}T10:00:00Z`},
    {id:'two',version:otherVersion,bundleId:rule.id,bundleName:rule.name,bundleContext:bundleContext(rule),response:'Draft'},
    {id:'three',version,response:'Not started'}];
  const groups = assessmentBundleGroups({collections:records},records,[rule]);
  assert.equal(groups.length,2);assert.equal(groups[0].records.length,2);assert.equal(groups[0].records[0].id,'two');
  assert.match(groups[0].description,/Program stream \/ care-level condition/);
  assert.equal(groups[1].name,'Individual measures');
  assert.equal(assessmentBundleGroups({collections:records},[records[1]],[])[0].name,rule.name);
  assert.match(assessmentBundleGroups({collections:records},[records[1]],[])[0].description,/Every 28 days/);
  assert.match(bundleDescription({trigger:'event',eventType:'harm',delayDays:2}),/Event trigger.*Due 2 days after event/);
});
test('optional-only bundles need a selection and unavailable mandatory items block creation', () => {
  assert.match(newBundleError({...rule,assessments:[item('opt','Optional')]},[],[],{},{}),/at least one/);
  assert.match(newBundleError({...rule,assessments:[item('mandatory','Mandatory',{channel:'SMS link'})]},[],[],{},{assessmentSms:false}),/SMS/);
  assert.match(newBundleError({...rule,assessments:[item('mandatory','Mandatory',{recipient:'Family respondent'})]},[],[],{},{}),/Choose an enabled assessment/);
});
test('shared delivery and recipient apply to selected mandatory and optional rows without changing the template', () => {
  const state = prepare();
  const before = structuredClone(state.settings.assessmentScheduleRules);
  const next = reducer(state,action({optionalIds:['optional'],assessmentOverrides:[
    {id:'mandatory',channel:'Clinician entry',recipient:'Person'},
    {id:'optional',channel:'Clinician entry',recipient:'Person'}]}));
  const created = getEpisode(next).collections.filter(collection => collection.bundleInstanceId === 'manual-bundle');
  assert.deepEqual(created.map(collection => [collection.channel,collection.respondent,collection.assistance,collection.bundleRequirement]),
    [['Clinician entry','Person','Transcribed','Mandatory'],['Clinician entry','Person','Transcribed','Optional']]);
  assert.deepEqual(next.settings.assessmentScheduleRules,before);
  const loaded = upgradeSampleData(JSON.parse(JSON.stringify(next)));
  assert.equal(getEpisode(loaded).collections.find(collection => collection.id === created[0].id).respondent,'Person');
});
test('delivery edits can recover unavailable defaults but cannot bypass channel, recipient or item validation', () => {
  const enabled = prepare();
  const smsRule={...rule,assessments:[item('mandatory','Mandatory',{channel:'SMS link'})]};
  const configured = reducer(reducer(enabled,{type:'SAVE_ASSESSMENT_SCHEDULE_RULE',rule:smsRule}),
    {type:'SET_ASSESSMENT_FEATURE',feature:'assessmentSms',enabled:false});
  assert.equal(reducer(configured,action()),configured);
  const recovered=reducer(configured,action({assessmentOverrides:[{id:'mandatory',channel:'Clinic tablet'}]}));
  assert.equal(getEpisode(recovered).collections.at(-1).channel,'Clinic tablet');
  const state = reducer(enabled,{type:'SET_ASSESSMENT_FEATURE',feature:'assessmentSms',enabled:false});
  for (const assessmentOverrides of [[{id:'mandatory',channel:'Invalid'}],[{id:'mandatory',channel:'SMS link'}],
    [{id:'mandatory',recipient:'Family respondent'}],[{id:'mandatory',recipient:'Invalid'}],[{id:'missing',channel:'Clinic tablet'}],
    [{id:'mandatory',requirement:'Optional'}],[{id:'mandatory',version:otherVersion}],
    [{id:'mandatory',channel:'Clinician entry'},{id:'mandatory',channel:'Clinic tablet'}]])
    assert.equal(reducer(state,action({assessmentOverrides})),state);
  const unsupported={...rule,assessments:[item('mandatory','Mandatory',{version:INSTRUMENTS.find(instrument => !instrument.respondents.includes('Family respondent')).version})]};
  const patientOnly=reducer(state,{type:'SAVE_ASSESSMENT_SCHEDULE_RULE',rule:unsupported});
  patientOnly.people.find(person => person.id === context.personId).family='Taylor Ellis';
  assert.equal(reducer(patientOnly,action({assessmentOverrides:[{id:'mandatory',recipient:'Family respondent'}]})),patientOnly);
});

const editAction = (extra={}) => ({...action(),type:'UPDATE_ASSESSMENT_BUNDLE',id:'bundle-edit',...extra});
test('editing a bundle removes only untouched optional records, adds extras and keeps its template and mandatory records', () => {
  const state = reducer(prepare(),action({optionalIds:['optional']}));
  const before = JSON.parse(JSON.stringify(getEpisode(state).collections));
  const mandatory = before.find(collection => collection.bundleAssessmentId === 'mandatory');
  const optional = before.find(collection => collection.bundleAssessmentId === 'optional');
  const next = reducer(state,editAction({extraAssessments:[item('extra','Optional',{version:otherVersion})]}));
  assert.notEqual(next,state);
  const episode = getEpisode(next);
  assert.deepEqual(episode.collections.find(collection => collection.id === mandatory.id),mandatory);
  assert.equal(episode.collections.some(collection => collection.id === optional.id),false);
  assert.deepEqual(episode.removedBundleAssessments.find(collection => collection.id === optional.id),optional);
  assert.equal(episode.collections.filter(collection => collection.bundleAssessmentId === 'extra').length,1);
  assert.equal(episode.collections.find(collection => collection.bundleAssessmentId === 'extra').bundleRequirement,'Additional');
  assert.deepEqual(next.settings.assessmentScheduleRules,state.settings.assessmentScheduleRules);
  const loaded = upgradeSampleData(JSON.parse(JSON.stringify(next)));
  assert.deepEqual(bundleSelectionForEpisode(rule,getEpisode(loaded)).optionalIds,[]);
  assert.equal(getEpisode(loaded).collections.some(collection => collection.id === optional.id),false);
  const restored = reducer(loaded,editAction({id:'restore-edit',optionalIds:['optional']}));
  assert.deepEqual(getEpisode(restored).collections.find(collection => collection.id === optional.id),optional);
  assert.ok(getEpisode(restored).assessmentBundleInstances[0].collectionIds.includes(optional.id));
});
test('removing optional types preserves drafts, completed responses, delivery evidence and contact associations', () => {
  for (const evidence of [{response:'Draft',answers:['Saved answer']},{response:'Submitted',submittedAt:`${TODAY}T10:00:00Z`},
    {attempts:[{id:'attempt',channel:'Clinic tablet'}]},{appointmentId:'appt'},{}]) {
    const state = reducer(prepare(),action({optionalIds:['optional']}));
    const episode = getEpisode(state);
    const record = episode.collections.find(collection => collection.bundleAssessmentId === 'optional');
    Object.assign(record,evidence);
    if (!Object.keys(evidence).length) {
      episode.appointments.push({id:'appt'});
      episode.assessmentContactLinks = [{collectionId:record.id,appointmentId:'appt'}];
    }
    const before = JSON.parse(JSON.stringify(record));
    const next = reducer(state,editAction({assessmentOverrides:[{id:'optional',channel:'Clinic tablet'}]}));
    assert.notEqual(next,state);
    assert.deepEqual(getEpisode(next).collections.find(collection => collection.id === record.id),before);
    assert.deepEqual(bundleSelectionForEpisode(rule,getEpisode(next)).optionalIds,[]);
  }
});
test('invalid bundle edits are atomic and unavailable care episodes reject edits', () => {
  const state = reducer(reducer(prepare(),action({optionalIds:['optional']})),
    {type:'SET_ASSESSMENT_FEATURE',feature:'assessmentSms',enabled:false});
  for (const values of [{optionalIds:['mandatory']},{bundleId:'missing'},{optionalIds:['optional','optional']},
    {assessmentOverrides:[{id:'mandatory',requirement:'Optional'}]},
    {extraAssessments:[item('extra','Optional',{version:otherVersion,channel:'SMS link'})]},
    {extraAssessments:[item('extra','Mandatory',{version:otherVersion})]},{due:TODAY}])
    assert.equal(reducer(state,editAction(values)),state);
  for (const field of ['readOnly','closed']) {
    const locked = structuredClone(state);
    if (field === 'closed') getEpisode(locked).status='Closed';else getEpisode(locked).readOnly=true;
    assert.equal(reducer(locked,editAction()),locked);
  }
});
test('saved bundle selections keep excluded assessments out of future automatic collections and avoid duplicate extras', () => {
  const state = reducer(prepare(),action({optionalIds:['optional']}));
  const next = reducer(state,editAction({extraAssessments:[item('extra','Optional',{version:otherVersion})]}));
  const automatic = {...next,settings:{...next.settings,automaticAssessmentDueDates:true}};
  const generated = reconcileAssessmentBundles(automatic,TODAY);
  const episode = getEpisode(generated);
  assert.equal(episode.collections.filter(collection => collection.bundleId === rule.id && collection.bundleAssessmentId === 'extra').length,1);
  assert.ok(!episode.assessmentBundleOffers.some(offer => offer.bundleId === rule.id && offer.assessment.id === 'optional' && offer.status === 'Pending'));
  assert.ok(!episode.collections.some(collection => collection.bundleId === rule.id && collection.bundleAssessmentId === 'optional'));
  assert.equal(reconcileAssessmentBundles(generated,TODAY),generated);
  const savedAgain = reducer(next,editAction({extraAssessments:[item('extra','Optional',{version:otherVersion})]}));
  assert.equal(getEpisode(savedAgain).collections.length,getEpisode(next).collections.length);
});
test('reincluding an additional assessment reuses its existing draft even when the picker supplies a new identifier', () => {
  const state = reducer(prepare(),action({extraAssessments:[item('extra','Optional',{version:otherVersion})]}));
  const record = getEpisode(state).collections.find(collection => collection.bundleAssessmentId === 'extra');
  record.response='Draft';record.answers=['Saved answer'];
  const removed = reducer(state,editAction());
  const reselected = reducer(removed,editAction({extraAssessments:[item('new-extra-id','Optional',{version:otherVersion})]}));
  const records = getEpisode(reselected).collections.filter(collection => collection.bundleId === rule.id && collection.version === otherVersion);
  assert.equal(records.length,1);assert.equal(records[0].id,record.id);assert.deepEqual(records[0].answers,record.answers);
  assert.equal(getEpisode(reselected).assessmentBundleSelections[rule.id].extraAssessments[0].id,'extra');
});

test('single assessment bundle association persists while individual remains the default', () => {
  const state = prepare();
  const plan = {type:'PLAN',...context,id:'single-associated',label:'Single assessment',version,respondent:'Person',channel:'Clinic tablet',due:''};
  const associated = reducer(state,{...plan,bundleId:rule.id});
  const record = getEpisode(associated).collections.find(collection => collection.id === plan.id);
  assert.equal(record.bundleId,rule.id);
  assert.equal(record.bundleAssessmentId,'mandatory');
  assert.equal(record.bundleRequirement,'Mandatory');
  assert.equal(record.bundleSource,'Manual');
  const restored = upgradeSampleData(JSON.parse(JSON.stringify(associated)));
  assert.equal(getEpisode(restored).collections.find(collection => collection.id === plan.id).bundleId,rule.id);
  const additional = reducer(state,{...plan,version:otherVersion,bundleId:rule.id});
  assert.equal(getEpisode(additional).collections.find(collection => collection.id === plan.id).bundleRequirement,'Additional');
  const individual = reducer(state,plan);
  assert.equal(getEpisode(individual).collections.find(collection => collection.id === plan.id).bundleId,undefined);
  assert.equal(reducer(state,{...plan,bundleId:'missing'}),state);
  const disabled = reducer(state,{type:'SET_ASSESSMENT_FEATURE',feature:'groupAssessmentsByBundle',enabled:false});
  assert.equal(reducer(disabled,{...plan,bundleId:rule.id}),disabled);
  assert.ok(getEpisode(reducer(disabled,plan)).collections.some(collection => collection.id === plan.id));
});

test('named bundle instances keep unique IDs and names and edit independently', () => {
 let state = prepare();
 state = reducer(state,action({name:'My care review'}));
 const secondName = uniqueBundleInstanceName(getEpisode(state),'My care review');
 assert.equal(secondName,'My care review (2)');
 state = reducer(state,action({id:'second-bundle',name:secondName}));
 const groups = assessmentBundleGroups(getEpisode(state),getEpisode(state).collections,state.settings.assessmentScheduleRules);
 assert.equal(groups.find(group=>group.key==='manual-bundle').name,'My care review');
 assert.equal(groups.find(group=>group.key==='second-bundle').records.length,1);
 assert.equal(reducer(state,action({id:'duplicate',name:' MY CARE REVIEW '})),state);
 const before = JSON.stringify(getEpisode(state).collections.filter(item=>item.bundleInstanceId==='second-bundle'));
 state = reducer(state,action({type:'UPDATE_ASSESSMENT_BUNDLE',id:'edit',bundleInstanceId:'manual-bundle',name:'Renamed care review',optionalIds:['optional']}));
 assert.equal(JSON.stringify(getEpisode(state).collections.filter(item=>item.bundleInstanceId==='second-bundle')),before);
 assert.equal(getEpisode(state).assessmentBundleInstances.find(item=>item.id==='manual-bundle').name,'Renamed care review');
 assert.ok(getEpisode(state).collections.filter(item=>item.bundleInstanceId==='manual-bundle').every(item=>item.bundleName==='Renamed care review'));
});
