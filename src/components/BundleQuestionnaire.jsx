import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { useStore } from '../store';
import { canAssess } from '../intake';
import { canCollectInEpisode, currentStaff } from '../model';
import { patientIdentifier } from '../patientIdentity';
import { getInstrument, questionnaireState } from '../instruments';
import { assessmentContactLinkingEnabled, assessmentSmsEnabled, episodeWithVisibleContacts } from '../assessmentFeatures';
import { bundleCollectionGroup, bundleQuestionnaireProgress, nextBundleCollection } from '../bundleCollection';
import { bundleDelivery } from '../assessmentBundles';
import { Button, Logo, Modal, Notice, Success } from './UI';
import QuestionnaireFlow from './QuestionnaireFlow';
import QuestionnaireAppointmentConfirmation from './QuestionnaireAppointmentConfirmation';
import TabletAssistanceConfirmation from './TabletAssistanceConfirmation';
import DraftContactForm from './DraftContactForm';
import QuestionnaireAccessPanel from './QuestionnaireAccessPanel';
import DiscardChanges from './DiscardChanges';
import { Tabs } from './Tabs';

export default function BundleQuestionnaire({ person, episode, collection, onClose, participant = false, initialAttemptId }) {
  const { state, commit } = useStore();
  episode = episodeWithVisibleContacts(episode, state.settings);
  const group = bundleCollectionGroup(episode, collection, state.settings?.assessmentScheduleRules) ||
    { key: collection.id, name: collection.label || getInstrument(collection.version)?.name || "Questionnaire", records: [collection] };
  // Keep this session's list stable while submissions reorder the ledger.
  const [ids] = useState(() => group.records.map(record => record.id));
  const records = ids.map(id => episode.collections.find(record => record.id === id)).filter(Boolean);
  const [activeId, setActiveId] = useState(collection.id);
  const [drafts, setDrafts] = useState({});
  const attemptIds = useRef({ [collection.id]: initialAttemptId || collection.attempts?.at(-1)?.id });
  const [started, setStarted] = useState(!participant);
  const [pendingAnswers, setPendingAnswers] = useState(null);
  const [returnToReview, setReturnToReview] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [error, setError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const c = records.find(record => record.id === activeId);
  const answers = drafts[activeId] || c?.draftAnswers || [];
  const instrument = getInstrument(c?.version);
  const simple = !assessmentContactLinkingEnabled(state.settings);
  const staff = currentStaff(state);
  const completed = records.filter(record => record.response === 'Submitted').length;
  const finished = records.length > 0 && completed === records.length;
  const hasProgress = records.some(record => {
    const progress = bundleQuestionnaireProgress(record, drafts[record.id] || record.draftAnswers || []);
    return progress.completed || progress.answered > 0 || record.response === 'Draft';
  });
  const dirtyRecords = records.filter(record => record.response !== 'Submitted' && drafts[record.id] &&
    JSON.stringify(drafts[record.id]) !== JSON.stringify(record.draftAnswers || []));
  const dirty = dirtyRecords.length > 0;
  const draftRecords = records.filter(record => record.response !== 'Submitted' &&
    (record.id === activeId || dirtyRecords.includes(record)));
  const savedBundle = state.settings?.assessmentScheduleRules?.find(rule => rule.id === (group.bundleId || group.key));
  const delivery = savedBundle ? bundleDelivery(savedBundle,
    episode.assessmentBundleSelections?.[savedBundle.id]?.assessmentOverrides) : null;
  const [collectionTab, setCollectionTab] = useState(() => {
    const method = delivery?.channel || collection.channel;
    return method === 'SMS link' ? 'sms' : method === 'Clinic tablet' ? 'tablet' : 'clinician';
  });
  const collectionTabs = [{ value: 'clinician', label: 'Clinician' },
    { value: 'tablet', label: 'Tablet' }, { value: 'sms', label: 'SMS' }];
  const context = id => ({ personId: person.id, episodeId: episode.id, collectionId: id });
  const blocker = record => !record ? 'This assessment is no longer in the bundle.'
    : !canAssess(person, episode) || !canCollectInEpisode(episode, record)
      ? 'This care episode is not available for collection.'
    : person.consent !== 'Recorded' || person.contact !== 'Suitable'
      ? 'Check participation consent and contact suitability in the record.'
    : ['Cancelled', 'Paused'].includes(record.assignment) ? `This assessment is ${record.assignment.toLowerCase()}.`
    : !getInstrument(record.version) ? 'This questionnaire version is unavailable.' : '';
  const attempt = c?.attempts?.at(-1);
  const unavailable = blocker(c) || (c?.response !== 'Submitted' &&
    (c?.assignment !== 'Active' || c?.link !== 'Active' || !attempt || attempt.endedAt ||
      attempt.id !== attemptIds.current[activeId] ||
      c.channel === 'SMS link' && !assessmentSmsEnabled(state.settings) ||
      c.channel === 'Clinician entry' && (staff?.role !== 'Clinician' || c.recorderId !== staff.id))
    ? 'This collection session is no longer available. Return to the record and reopen it.' : '');

  useEffect(() => {
    if (!dirty) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const requestClose = () => dirty ? setDiscard(true) : onClose();
  const selectRecord = (record, sourceEpisode = episode) => {
    setPendingAnswers(null);
    setReturnToReview(false);
    setSaveOpen(false);
    setError('');
    setActiveId(record.id);
    if (record.response === 'Submitted' || blocker(record)) return;
    // Revisiting an entered questionnaire must keep its original attempt.
    if (attemptIds.current[record.id]) return;
    const channel = delivery?.channel || record.channel || 'Clinic tablet';
    const respondent = record.draftAnswers?.some(Boolean) ? record.respondent : delivery?.recipient || record.respondent;
    const latest = record.attempts?.at(-1);
    const reusable = record.assignment === 'Active' && record.link === 'Active' && latest && !latest.endedAt &&
      latest.channel === channel && record.respondent === respondent &&
      (channel !== 'Clinician entry' || latest.recorderId === staff?.id);
    let prepared = record;
    if (!reusable) {
      const result = commit({ ...context(record.id), type: 'DELIVER', channel, respondent,
        assistance: channel === 'Clinician entry' ? 'Transcribed' : 'Independent',
        appointmentId: simple ? null : record.appointmentId || null });
      if (result.error) { setError(result.error); return; }
      prepared = result.state.people.find(item => item.id === person.id).episodes
        .find(item => item.id === sourceEpisode.id).collections.find(item => item.id === record.id);
    }
    attemptIds.current[record.id] = prepared.attempts.at(-1).id;
    if (participant && !prepared.attempts.at(-1).startedAt) {
      const result = commit({ ...context(record.id), type: 'START_RESPONSE_SESSION',
        channel: prepared.channel, attemptId: attemptIds.current[record.id] });
      if (result.error) setError(result.error);
    }
  };
  const begin = () => {
    if (unavailable) return;
    if (!attempt.startedAt) {
      const result = commit({ ...context(c.id), type: 'START_RESPONSE_SESSION', channel: c.channel, attemptId: attempt.id });
      if (result.error) { setError(result.error); return; }
    }
    setStarted(true);
  };
  const submit = (finalAnswers, confirmation = {}) => {
    if (unavailable || !questionnaireState(instrument, finalAnswers).complete) return;
    const result = commit({ ...context(c.id), type: 'SUBMIT', answers: finalAnswers,
      channel: c.channel, attemptId: attemptIds.current[c.id], ...confirmation });
    if (result.error) { setError(result.error); return; }
    const nextEpisode = result.state.people.find(item => item.id === person.id).episodes.find(item => item.id === episode.id);
    const nextRecords = ids.map(id => nextEpisode.collections.find(record => record.id === id)).filter(Boolean);
    const next = nextBundleCollection(nextRecords, c.id);
    setAnnouncement(`${instrument.name} completed and saved.${next ? ' Continue with the next questionnaire.' : ''}`);
    setPendingAnswers(null);
    setError('');
    if (next) selectRecord(next, nextEpisode);
  };
  const completeQuestions = finalAnswers => {
    if (!simple || c.channel === 'Clinic tablet') setPendingAnswers(finalAnswers);
    else submit(finalAnswers);
  };
  const saveDrafts = (contactLink, completionMethod, assistance) => {
    let sharedLink = contactLink;
    for (const record of draftRecords) {
      const result = commit({ ...context(record.id), type: 'SAVE_RESPONSE_PROGRESS',
        channel: record.channel, attemptId: attemptIds.current[record.id], answers: drafts[record.id] || record.draftAnswers || [],
        contactLink: sharedLink, completionMethod, assistance });
      if (result.error) { setError(result.error); return; }
      if (sharedLink?.kind === 'new') {
        const saved = result.state.people.find(item => item.id === person.id).episodes.find(item => item.id === episode.id)
          .collections.find(item => item.id === record.id);
        sharedLink = { kind: 'existing', appointmentId: saved.attempts.at(-1).appointmentId };
      }
    }
    onClose();
  };
  const requestSaveDraft = () => {
    setError('');
    if (!dirty && answers.some(Boolean)) return onClose();
    if (draftRecords.every(record => !(drafts[record.id] || record.draftAnswers || []).some(Boolean))) {
      saveDrafts({ kind: 'none' });
    } else setSaveOpen(true);
  };
  const linkedId = c?.attempts?.at(-1)?.appointmentId || c?.appointmentId;
  const linkedAppointment = !simple && episode.appointments?.find(item => item.id === linkedId &&
    ['Planned', 'Attended'].includes(item.attendance));
  const body = <>
    <div className="bundle-collection-layout" hidden={discard}>
      <aside className="bundle-collection-sidebar" aria-label="Bundle progress">
        <div className="bundle-collection-progress">
          <h3>Questionnaires</h3>
          <p><strong>{completed} of {records.length}</strong> completed</p>
          <div className="progress-track" role="progressbar" aria-label="Questionnaires completed"
            aria-valuemin={0} aria-valuemax={records.length} aria-valuenow={completed}>
            <span style={{width: `${completed / records.length * 100}%`}} />
          </div>
        </div>
        <nav aria-label="Bundle questionnaires"><ol>
          {records.map((record, index) => {
            const progress = bundleQuestionnaireProgress(record, drafts[record.id] || record.draftAnswers || []);
            const percent = progress.completed ? 100 : progress.total ? Math.round(progress.answered / progress.total * 100) : 0;
            return <li key={record.id}><button type="button" aria-current={record.id === activeId ? 'step' : undefined}
              data-completed={progress.completed || undefined}
              aria-label={`${index + 1}. ${getInstrument(record.version)?.name || record.label}. ${progress.label}. ${percent}% answered`}
              disabled={!started || !!pendingAnswers || saveOpen || finished}
              onClick={() => selectRecord(record)}>
              <span className={`bundle-collection-number${progress.completed ? ' completed' : ''}`}
                role="progressbar" aria-label={`${getInstrument(record.version)?.name || record.label} progress`}
                aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                <svg className="bundle-instrument-progress" viewBox="0 0 36 36" aria-hidden="true">
                  <circle className="bundle-instrument-progress-track" cx="18" cy="18" r="16" />
                  <circle className="bundle-instrument-progress-fill" cx="18" cy="18" r="16"
                    pathLength="100" strokeDasharray={`${percent} 100`} />
                </svg>
                {progress.completed ? <Check size={15} aria-hidden="true" /> : index + 1}
              </span>
              <span className="bundle-collection-item"><strong>{getInstrument(record.version)?.name || record.label}</strong>
                <small>{progress.completed ? 'Completed and saved' : progress.answered
                  ? `${progress.answered} of ${progress.total} answered` : progress.label}</small>
              </span>
            </button></li>;
          })}
        </ol></nav>
      </aside>
      <section className="bundle-collection-content" aria-label="Current questionnaire">
        <p className="sr-only" role="status">{announcement}</p>
        {participant && !started && !finished && <Tabs id="collection-delivery" label="Collection method"
          items={collectionTabs} value={collectionTab} onChange={setCollectionTab} />}
        <div id="collection-delivery-panel" role={participant && !started && !finished ? 'tabpanel' : undefined}
          aria-labelledby={participant && !started && !finished ? `collection-delivery-tab-${collectionTabs.findIndex(tab => tab.value === collectionTab)}` : undefined}>
        {participant && !started && !finished && collectionTab !== 'clinician'
          ? <QuestionnaireAccessPanel key={collection.id} person={person} episodeId={episode.id}
              collectionId={collection.id} mode={collectionTab} onBack={requestClose} />
          : finished ? <Success title="Bundle completed" action={<Button variant="primary" onClick={onClose}>Back to record</Button>}>
          All {records.length} questionnaire responses are saved. They are available in the assessment record.
        </Success> : !started ? <div className="bundle-collection-intro">
          <h2>A check-in, one questionnaire at a time.</h2>
          <p>This bundle has {records.length - completed} questionnaires left to complete. The list shows where you are and what is still to do.</p>
          <p>{hasProgress ? 'Your saved progress is here. Drafts still need to be submitted to complete a questionnaire.'
            : 'You can save a draft and take a break at any time.'}</p>
          <Button variant="primary" disabled={!!unavailable} onClick={begin}>{hasProgress ? 'Continue bundle' : 'Begin bundle'} <ArrowRight size={18} /></Button>
          <Button variant="ghost" onClick={requestClose}>Back to record</Button>
          {unavailable && <Notice tone="amber">{unavailable}</Notice>}
        </div> : <>
          {saveOpen ? <>
            <Notice>{draftRecords.length} {draftRecords.length === 1 ? 'questionnaire draft will' : 'questionnaire drafts will'} be saved. Completed responses are already saved.</Notice>
            <DraftContactForm episode={episode} collection={draftRecords[0] || c} error={error}
              showContactChoice={!simple} confirmTabletAssistance={simple}
              onCancel={() => { setSaveOpen(false); setError(''); }} onSave={saveDrafts} />
          </> : c?.response === 'Submitted' ? <Notice>This response has already been completed and saved.
            <Button onClick={() => selectRecord(records.find(record => record.response !== 'Submitted'))}>Continue remaining questionnaires</Button>
          </Notice>
          : unavailable ? <Notice tone="amber">{unavailable} Select another questionnaire or return to the record.</Notice>
          : pendingAnswers ? simple ? <TabletAssistanceConfirmation error={error}
            onBack={() => { setPendingAnswers(null); setReturnToReview(true); setError(''); }}
            onConfirm={confirmation => submit(pendingAnswers, confirmation)} />
          : <QuestionnaireAppointmentConfirmation collection={c} episode={episode} appointment={linkedAppointment}
            error={error} tablet={participant}
            onBack={() => { setPendingAnswers(null); setReturnToReview(true); setError(''); }}
            onConfirm={confirmation => submit(pendingAnswers, confirmation)} />
          : <QuestionnaireFlow key={activeId} instrument={instrument} respondent={c.respondent}
            answers={answers} onChange={value => { setDrafts(prev => ({...prev, [activeId]:value})); setError(''); }}
            onSubmit={completeQuestions} initialReview={returnToReview} headingLevel="h3" showProgress={false}
            clinicianEntry={c.channel === 'Clinician entry'}
            secondaryAction={<Button disabled={!!unavailable} onClick={requestSaveDraft}>Save draft and leave</Button>}
            submitLabel={!simple ? 'Continue to completion details' : c.channel === 'Clinic tablet'
              ? 'Confirm tablet assistance' : nextBundleCollection(records, c.id) ? 'Save and continue' : 'Complete bundle'} />}
          {error && !saveOpen && !pendingAnswers && <p className="field-error" role="alert">{error}</p>}
        </>}
        </div>
      </section>
    </div>
    {discard && <DiscardChanges onKeepEditing={() => setDiscard(false)} onDiscard={onClose} />}
  </>;
  return participant ? <div className="participant bundle-questionnaire">
    <header className="participant-header"><Logo /><span>Bundle questionnaires · sample content</span></header>
    <main className="bundle-collection-participant">
      <div className="bundle-questionnaire-workspace">
        <header className="bundle-collection-page-heading"><h1>{group.name}</h1>
        </header>{body}
      </div>
    </main>
    <footer className="participant-footer">YSCC · Care, connected</footer>
  </div> : <Modal title={group.name} subtitle={`${patientIdentifier(person)} · Collect bundle responses`}
    onClose={requestClose} wide className="bundle-collection-modal">{body}</Modal>;
}
