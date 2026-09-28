import test from 'node:test';
import assert from 'node:assert/strict';
import { contactsForAssessments } from './assessmentContacts.js';

test('bundle contacts appear once and retain every linked assessment across explicit and legacy links', () => {
  const first = {id:'first',appointmentId:'contact',attempts:[{appointmentId:'contact'}]};
  const second = {id:'second'};
  const contact = {id:'contact'};
  const unrelated = {id:'unrelated',appointmentId:'other-contact'};
  const episode = {collections:[first,second,unrelated],appointments:[contact,{id:'other-contact'}],
    assessmentContactLinks:[{collectionId:'first',appointmentId:'contact'},{collectionId:'second',appointmentId:'contact'}]};
  assert.deepEqual(contactsForAssessments(episode,[first,second]),[{contact,assessments:[first,second]}]);
});

test('matching dates do not establish an association and missing records are ignored', () => {
  const record = {id:'assessment',due:'2026-09-21'};
  const episode = {collections:[record],appointments:[{id:'contact',actualDate:'2026-09-21'}],
    assessmentContactLinks:[{collectionId:'missing',appointmentId:'contact'},{collectionId:record.id,appointmentId:'missing-contact'}]};
  assert.deepEqual(contactsForAssessments(episode,[record]),[]);
  assert.deepEqual(contactsForAssessments(undefined,[record]),[]);
});
