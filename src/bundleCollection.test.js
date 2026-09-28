import test from 'node:test';
import assert from 'node:assert/strict';
import { bundleCollectionGroup, nextBundleCollection, bundleQuestionnaireProgress } from './bundleCollection.js';
import { INSTRUMENTS } from './instruments.js';

const version = INSTRUMENTS[0].version;
const record = (id, extra = {}) => ({id, version, bundleId:'bundle', response:'Not started', ...extra});
test('collection includes the entire bundle list, including selected extras and previously completed responses', () => {
  const collection = record('first');
  const episode = {collections:[collection, record('optional',{bundleRequirement:'Optional'}),
    record('additional',{bundleRequirement:'Additional'}), record('completed',{response:'Submitted'}),
    record('other',{bundleId:'other'}), record('individual',{bundleId:undefined})]};
  const group = bundleCollectionGroup(episode,collection);
  assert.deepEqual(new Set(group.records.map(item => item.id)),new Set(['first','optional','additional','completed']));
  assert.equal(bundleCollectionGroup(episode,episode.collections.at(-1)),null);
  assert.equal(bundleCollectionGroup({collections:[{...collection,bundleId:undefined,scheduleRuleId:'deleted'}]},
    {...collection,bundleId:undefined,scheduleRuleId:'deleted'}).records.length,1);
});
test('advance visits every unfinished questionnaire, wraps to earlier drafts and stops only when all are submitted', () => {
  const records = [record('first',{response:'Draft'}),record('completed',{response:'Submitted'}),record('last')];
  assert.equal(nextBundleCollection(records,'first').id,'last');
  assert.equal(nextBundleCollection(records,'last').id,'first');
  assert.equal(nextBundleCollection(records.map(item => ({...item,response:'Submitted'})),'last'),undefined);
});
test('questionnaire progress distinguishes answering from a committed response', () => {
  const collection = record('first');
  const instrument = INSTRUMENTS[0];
  assert.equal(bundleQuestionnaireProgress(collection).label,'Not started');
  const answers = instrument.questions.map(question => question.options.at(-1));
  assert.equal(bundleQuestionnaireProgress(collection,answers).label,'Ready to submit');
  assert.equal(bundleQuestionnaireProgress(collection,answers).completed,false);
  assert.equal(bundleQuestionnaireProgress({...collection,response:'Submitted'}).completed,true);
});

test('an in-memory fictional bundle saves each instrument once and resumes drafts before advancing', async () => {
  const { emptyDraftSeed } = await import('./testFixtures.js');
  const { reducer } = await import('./model.js');
  let state = emptyDraftSeed();
  const personId = 'YS-1024', episodeId = 'EP-1024-01';
  const getEpisode = value => value.people.find(person => person.id === personId).episodes.find(episode => episode.id === episodeId);
  const episode = getEpisode(state);
  const source = episode.collections.at(-1);
  episode.collections = ['bundle-test-one','bundle-test-two'].map(id => ({...structuredClone(source),id,
    version,bundleId:'test-bundle',response:'Not started',assignment:'Planned',link:'Not sent',attempts:[],
    draftAnswers:[],answers:[]}));
  const instrument = INSTRUMENTS[0];
  const answers = instrument.questions.map(question => question.options.at(-1));
  const deliver = id => ({type:'DELIVER',personId,episodeId,collectionId:id,channel:'Clinician entry',respondent:'Person',assistance:'Transcribed'});
  state = reducer(state,deliver('bundle-test-one'));
  let first = getEpisode(state).collections[0];
  state = reducer(state,{type:'SAVE_RESPONSE_PROGRESS',personId,episodeId,collectionId:first.id,
    channel:first.channel,attemptId:first.attempts.at(-1).id,answers:[answers[0]]});
  assert.equal(getEpisode(state).collections[0].response,'Draft');
  state = reducer(state,deliver(first.id));
  assert.equal(getEpisode(state).collections[0].draftAnswers[0],answers[0]);
  for (const id of ['bundle-test-one','bundle-test-two']) {
    if(id === 'bundle-test-two') state = reducer(state,deliver(id));
    const collection = getEpisode(state).collections.find(item => item.id === id);
    const action = {type:'SUBMIT',personId,episodeId,collectionId:id,channel:collection.channel,
      attemptId:collection.attempts.at(-1).id,answers};
    const saved = reducer(state,action);
    assert.notEqual(saved,state);
    assert.equal(getEpisode(saved).collections.find(item => item.id === id).response,'Submitted');
    assert.equal(reducer(saved,action),saved);
    state = saved;
    const next = nextBundleCollection(getEpisode(state).collections,id);
    assert.equal(next?.id,id === 'bundle-test-one' ? 'bundle-test-two' : undefined);
  }
  assert.equal(getEpisode(state).collections.filter(item => item.response === 'Submitted').length,2);
});
