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
import { mvpAssessmentMode } from '../mvpAssessmentPathway';
import { clientProfileReadOnlyFacts } from '../clientProfileMeasure';
import { Button, Logo, Modal, Notice, ProductCopy, Success } from './UI';
import QuestionnaireFlow from './QuestionnaireFlow';
import QuestionnaireAppointmentConfirmation from './QuestionnaireAppointmentConfirmation';
import TabletAssistanceConfirmation from './TabletAssistanceConfirmation';
import DraftContactForm from './DraftContactForm';
import QuestionnaireAccessPanel from './QuestionnaireAccessPanel';
import DiscardChanges from './DiscardChanges';
import { Tabs } from './Tabs';

export default function BundleQuestionnaire({ person, episode, collection, onClose, participant = false, inline = false, initialAttemptId }) {
  const { state, commit } = useStore();
  const mvpBundle = mvpAssessmentMode(state.settings) && (!!collection.mvpTimepointId || !!collection.clientProfileMeasure);
  episode = episodeWithVisibleContacts(episode, state.settings);
  const group = bundleCollectionGroup(episode, collection, state.settings?.assessmentScheduleRules) ||
    { key: collection.id, name: collection.label || getInstrument(collection.version)?.name || "Instrument", records: [collection] };
  // Keep this session's list stable while submissions reorder the ledger.
  const [multipleInstances, setMultipleInstances] = useState(false);
  const presenceKey = `${person.id}:${episode.id}:${group.instanceId || group.key}`;
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(`yscc-bundle:${presenceKey}`);
    const id = crypto.randomUUID();
    const peers = new Map();
    const update = () => {
      const now = Date.now();
      for (const [peer, seen] of peers) if (now - seen > 45000) peers.delete(peer);
      setMultipleInstances(peers.size > 0);
    };
    const send = type => channel.postMessage({ id, type });
    channel.onmessage = ({ data }) => {
      if (!data?.id || data.id === id) return;
      if (data.type === 'bye') peers.delete(data.id);
      else if (['hello', 'present'].includes(data.type)) peers.set(data.id, Date.now());
      if (data.type === 'hello') send('present');
      update();
    };
    const leave = () => send('bye');
    window.addEventListener('pagehide', leave);
    send('hello');
    const heartbeat = setInterval(() => { send('hello'); update(); }, 15000);
    return () => {
      window.removeEventListener('pagehide', leave);
      clearInterval(heartbeat);
      send('bye');
      channel.close();
    };
  }, [presenceKey]);
  const [ids] = useState(() => group.records.map(record => record.id));
  const records = ids.map(id => episode.collections.find(record => record.id === id)).filter(Boolean);
  const introFlow = participant || inline;
  const staffCollectionEntry = !participant || new URLSearchParams(window.location.search).get('overview') === '1';
  const mvpReviewTabs = mvpBundle && state.settings?.mvpReviewHighlight === false && staffCollectionEntry;
  const mvpMethodLocked = mvpBundle && records.some(record => record.response !== 'Not started' ||
    record.draftAnswers?.some(Boolean) || record.answers?.some(Boolean));
  const mvpClinicianFirst = mvpAssessmentMode(state.settings) &&
    state.settings?.mvpReviewHighlight === false && staffCollectionEntry && !mvpMethodLocked;
  const [activeId, setActiveId] = useState(collection.id);
  const [drafts, setDrafts] = useState({});
  const attemptIds = useRef({ [collection.id]: initialAttemptId || collection.attempts?.at(-1)?.id });
  const [started, setStarted] = useState(!introFlow);
  const [pendingAnswers, setPendingAnswers] = useState(null);
  const [returnToReview, setReturnToReview] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [error, setError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const c = records.find(record => record.id === activeId);
  const answers = drafts[activeId] || c?.draftAnswers || [];
  const instrument = getInstrument(c?.version);
  const profileFacts = c?.clientProfileMeasure && instrument?.clientProfileSection
    ? clientProfileReadOnlyFacts(person, episode)[instrument.clientProfileSection] : null;
  const simple = !assessmentContactLinkingEnabled(state.settings);
  const separateMeasuresContacts = mvpAssessmentMode(state.settings) && !!state.settings?.mvpSeparateMeasuresContacts;
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
    if (mvpClinicianFirst) return 'clinician';
    const method = mvpAssessmentMode(state.settings) ? collection.channel : delivery?.channel || collection.channel;
    return method === 'SMS link' ? 'sms' : method === 'Clinic tablet' ? 'tablet' : 'clinician';
  });
  const clinicianTabCollection = (mvpClinicianFirst || mvpReviewTabs) && collectionTab === 'clinician';
  const channelForTab = { clinician: 'Clinician entry', tablet: 'Clinic tablet', sms: 'SMS link' };
  const collectionTabs = [{ value: 'clinician', label: 'Clinician' },
    { value: 'tablet', label: 'Tablet' }, { value: 'sms', label: 'SMS' }]
    .filter(tab => tab.value !== 'sms' || !mvpBundle || assessmentSmsEnabled(state.settings))
    .map(tab => ({ ...tab, disabled: mvpReviewTabs && mvpMethodLocked &&
      channelForTab[tab.value] !== c?.channel }));
  const changeCollectionTab = value => {
    if (mvpReviewTabs && !mvpMethodLocked && records.some(record => record.channel !== channelForTab[value])) {
      const result = commit({ type: 'SET_MVP_BUNDLE_METHOD', personId: person.id, episodeId: episode.id,
        bundleId: collection.bundleId, channel: channelForTab[value] });
      if (result.error) { setError(result.error); return; }
    }
    setError('');
    setCollectionTab(value);
  };
  const context = id => ({ personId: person.id, episodeId: episode.id, collectionId: id });
  const blocker = record => !record ? 'This instrument is no longer in the assessment.'
    : !canAssess(person, episode) || !canCollectInEpisode(episode, record)
      ? 'This care episode is not available for collection.'
    : !record.clientProfileMeasure && (person.consent !== 'Recorded' || person.contact !== 'Suitable')
      ? 'Check participation consent and contact suitability in the record.'
    : ['Cancelled', 'Paused'].includes(record.assignment) ? `This instrument is ${record.assignment.toLowerCase()}.`
    : !getInstrument(record.version) ? 'This instrument version is unavailable.' : '';
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
    const channel = clinicianTabCollection ? 'Clinician entry' :
      (mvpAssessmentMode(state.settings) ? record.channel : delivery?.channel || record.channel) || 'Clinic tablet';
    const respondent = record.draftAnswers?.some(Boolean) ? record.respondent : delivery?.recipient || record.respondent;
    const latest = record.attempts?.at(-1);
    // Revisiting an entered questionnaire keeps its attempt unless the method changed.
    if (attemptIds.current[record.id] === latest?.id && latest?.channel === channel && !latest.endedAt) return;
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
    if (introFlow && !prepared.attempts.at(-1).startedAt) {
      const result = commit({ ...context(record.id), type: 'START_RESPONSE_SESSION',
        channel: prepared.channel, attemptId: attemptIds.current[record.id] });
      if (result.error) setError(result.error);
    }
  };
  const begin = () => {
    if (blocker(c)) return;
    let prepared = c;
    const channel = clinicianTabCollection ? 'Clinician entry' :
      (mvpAssessmentMode(state.settings) ? c.channel : delivery?.channel || c.channel) || 'Clinic tablet';
    if (mvpBundle && c.channel !== channel) {
      const result = commit({ type: 'SET_MVP_BUNDLE_METHOD', personId: person.id, episodeId: episode.id,
        bundleId: c.bundleId, channel });
      if (result.error) { setError(result.error); return; }
      prepared = result.state.people.find(item => item.id === person.id).episodes
        .find(item => item.id === episode.id).collections.find(item => item.id === c.id);
    }
    if (unavailable || c.channel !== channel) {
      const result = commit({ ...context(c.id), type: 'DELIVER', channel,
        respondent: prepared.draftAnswers?.some(Boolean) ? prepared.respondent : delivery?.recipient || prepared.respondent,
        assistance: channel === 'Clinician entry' ? 'Transcribed' : 'Independent',
        appointmentId: simple ? null : prepared.appointmentId || null });
      if (result.error) { setError(result.error); return; }
      prepared = result.state.people.find(item => item.id === person.id).episodes
        .find(item => item.id === episode.id).collections.find(item => item.id === c.id);
      if (prepared.channel !== channel) { setError('Unable to start collection with this method.'); return; }
    }
    const latest = prepared.attempts?.at(-1);
    if (!latest || latest.endedAt) { setError('Unable to reopen this instrument.'); return; }
    attemptIds.current[c.id] = latest.id;
    if (!latest.startedAt) {
      const result = commit({ ...context(c.id), type: 'START_RESPONSE_SESSION', channel: prepared.channel, attemptId: latest.id });
      if (result.error) { setError(result.error); return; }
    }
    setError('');
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
    setAnnouncement(`${instrument.name} completed and saved.${next ? ' Continue with the next instrument.' : ''}`);
    setPendingAnswers(null);
    setError('');
    if (next) selectRecord(next, nextEpisode);
  };
  const completeQuestions = finalAnswers => {
    if (!separateMeasuresContacts && (!simple || c.channel === 'Clinic tablet')) setPendingAnswers(finalAnswers);
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
    if (separateMeasuresContacts) {
      setSaveOpen(false);
      setDraftSaved(true);
      setAnnouncement('Draft saved.');
    } else onClose();
  };
  const requestSaveDraft = () => {
    setError('');
    if (!dirty && answers.some(Boolean)) {
      if (separateMeasuresContacts) setDraftSaved(true);
      else onClose();
      return;
    }
    if (separateMeasuresContacts) return saveDrafts({ kind: 'none' });
    if (draftRecords.every(record => !(drafts[record.id] || record.draftAnswers || []).some(Boolean))) {
      saveDrafts({ kind: 'none' });
    } else setSaveOpen(true);
  };
  const linkedId = c?.attempts?.at(-1)?.appointmentId || c?.appointmentId;
  const linkedAppointment = !simple && episode.appointments?.find(item => item.id === linkedId &&
    ['Planned', 'Attended'].includes(item.attendance));
  const body = <>
    <div className="bundle-collection-layout" hidden={discard}>
      <aside className="bundle-collection-sidebar" aria-label="Assessment progress">
        <div className="bundle-collection-progress">
          <h3>Instruments</h3>
          <p><strong>{completed} of {records.length}</strong> completed</p>
          <div className="progress-track" role="progressbar" aria-label="Instruments completed"
            aria-valuemin={0} aria-valuemax={records.length} aria-valuenow={completed}>
            <span style={{width: `${completed / records.length * 100}%`}} />
          </div>
        </div>
        <nav aria-label="Assessment instruments"><ol>
          {records.map((record, index) => {
            const progress = bundleQuestionnaireProgress(record, drafts[record.id] || record.draftAnswers || []);
            const percent = progress.completed ? 100 : progress.total ? Math.round(progress.answered / progress.total * 100) : 0;
            return <li key={record.id}><button type="button" aria-current={record.id === activeId ? 'step' : undefined}
              data-completed={progress.completed || undefined}
              aria-label={`${index + 1}. ${getInstrument(record.version)?.name || record.label}. ${progress.label}. ${percent}% answered`}
              disabled={!started || !!pendingAnswers || saveOpen || finished || draftSaved}
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
      <section className="bundle-collection-content" aria-label="Current instrument">
        {multipleInstances && <div role="alert"><Notice tone="amber">This assessment is open in another tab or window. You can continue here; changes made in either instance may affect the other.</Notice></div>}
        <p className="sr-only" role="status">{announcement}</p>
        {introFlow && (!mvpBundle || mvpReviewTabs) && !started && !finished && <Tabs id="collection-delivery" label="Collection method"
          items={collectionTabs} value={collectionTab} onChange={changeCollectionTab} />}
        <div id="collection-delivery-panel" role={introFlow && (!mvpBundle || mvpReviewTabs) && !started && !finished ? 'tabpanel' : undefined}
          aria-labelledby={introFlow && (!mvpBundle || mvpReviewTabs) && !started && !finished ? `collection-delivery-tab-${collectionTabs.findIndex(tab => tab.value === collectionTab)}` : undefined}>
        {draftSaved ? <Success title="Draft saved" action={<Button variant="primary" onClick={onClose}>Back to record</Button>}>
          Your answers are saved as a draft on the instrument. You can continue this assessment later.
        </Success> : introFlow && !started && !finished && collectionTab !== 'clinician'
          ? <QuestionnaireAccessPanel key={collection.id} person={person} episodeId={episode.id}
              collectionId={collection.id} mode={collectionTab} onBack={requestClose} />
          : finished ? <Success title="Assessment completed" action={<Button variant="primary" onClick={onClose}>Back to record</Button>}>
          All {records.length} instrument responses are saved. They are available in the assessment record.
        </Success> : !started ? <div className="bundle-collection-intro">
          <h2>A check-in, one instrument at a time.</h2>
          <p>This assessment has {records.length - completed} instruments left to complete. The list shows where you are and what is still to do.</p>
          <p>{hasProgress ? 'Your saved progress is here. Drafts still need to be submitted to complete an instrument.'
            : 'You can save a draft and take a break at any time.'}</p>
          <Button variant="primary" disabled={!!blocker(c) || clinicianTabCollection && staff?.role !== 'Clinician'} onClick={begin}>{hasProgress ? 'Continue assessment' : 'Begin assessment'} <ArrowRight size={18} /></Button>
          <Button variant="ghost" onClick={requestClose}>Back to record</Button>
          {blocker(c) && <Notice tone="amber">{blocker(c)}</Notice>}
          {clinicianTabCollection && staff?.role !== 'Clinician' && <Notice tone="amber">Choose a Clinician profile to collect this response.</Notice>}
          {error && <p className="field-error" role="alert">{error}</p>}
        </div> : <>
          {saveOpen ? <>
            <Notice>{draftRecords.length} {draftRecords.length === 1 ? 'instrument draft will' : 'instrument drafts will'} be saved. Completed responses are already saved.</Notice>
            <DraftContactForm episode={episode} collection={draftRecords[0] || c} error={error}
              showContactChoice={!simple} confirmTabletAssistance={simple}
              onCancel={() => { setSaveOpen(false); setError(''); }} onSave={saveDrafts} />
          </> : c?.response === 'Submitted' ? <Notice>This response has already been completed and saved.
            <Button onClick={() => selectRecord(records.find(record => record.response !== 'Submitted'))}>Continue remaining instruments</Button>
          </Notice>
          : unavailable ? <Notice tone="amber">{unavailable} Select another instrument or return to the record.</Notice>
          : pendingAnswers ? simple ? <TabletAssistanceConfirmation error={error}
            onBack={() => { setPendingAnswers(null); setReturnToReview(true); setError(''); }}
            onConfirm={confirmation => submit(pendingAnswers, confirmation)} />
          : <QuestionnaireAppointmentConfirmation collection={c} episode={episode} appointment={linkedAppointment}
            error={error} tablet={participant}
            onBack={() => { setPendingAnswers(null); setReturnToReview(true); setError(''); }}
            onConfirm={confirmation => submit(pendingAnswers, confirmation)} />
          : <>{profileFacts?.length > 0 && <section className="client-profile-record-facts" aria-label="Current profile information">
            <h3>Current profile information</h3>
            <dl>{profileFacts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          </section>}
          <QuestionnaireFlow key={activeId} instrument={instrument} respondent={c.respondent}
            answers={answers} onChange={value => { setDrafts(prev => ({...prev, [activeId]:value})); setError(''); }}
            onSubmit={completeQuestions} initialReview={returnToReview} headingLevel="h3" showProgress={false}
            clinicianEntry={c.channel === 'Clinician entry'}
            secondaryAction={<Button disabled={!!unavailable} onClick={requestSaveDraft}>Save draft and leave</Button>}
            submitLabel={separateMeasuresContacts ? nextBundleCollection(records, c.id) ? 'Save and continue' : 'Complete assessment'
              : !simple ? 'Continue to completion details' : c.channel === 'Clinic tablet'
              ? 'Confirm tablet assistance' : nextBundleCollection(records, c.id) ? 'Save and continue' : 'Complete assessment'} /></>}
          {error && !saveOpen && !pendingAnswers && <p className="field-error" role="alert">{error}</p>}
        </>}
        </div>
      </section>
    </div>
    {discard && <DiscardChanges onKeepEditing={() => setDiscard(false)} onDiscard={onClose} />}
  </>;
  if (inline) return <ProductCopy><div className="bundle-collection-inline">{body}</div></ProductCopy>;
  return participant ? <ProductCopy><div className="participant bundle-questionnaire">
    <header className="participant-header"><Logo /><span>Assessment instruments · sample content</span></header>
    <main className="bundle-collection-participant">
      <div className="bundle-questionnaire-workspace">
        <header className="bundle-collection-page-heading"><h1>{group.name}</h1>
        </header>{body}
      </div>
    </main>
    <footer className="participant-footer">YSCC · Care, connected</footer>
  </div></ProductCopy> : <Modal title={group.name} subtitle={`${patientIdentifier(person)} · Collect assessment responses`}
    onClose={requestClose} wide className="bundle-collection-modal">{body}</Modal>;
}
